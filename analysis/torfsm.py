"""Abstract Tor FSM, test strategies, single-fault mutants and analysis helpers.

Python port of server/fsm.ts and experiments/baselines.mjs (Mulberry32-identical),
extended for the second-round revision:
  * explicit reset policies (R1.2)
  * classical FSM conformance-test baselines: W-method, Wp-method, UIO (R2.2)
  * five-step triage outcome of the 105 undefined pairs (R1.3, R2.4)
Every number reported in the revised manuscript is produced from this file by
run_all.py; nothing is entered by hand.
"""
from collections import deque
import itertools

STATES = ["IDLE", "CONNECTING", "TLS_HANDSHAKE", "CREATE_SENT", "CIRCUIT_BUILDING",
          "CIRCUIT_READY", "TRANSMITTING", "CLOSING", "CLOSED", "ERROR"]
EVENTS = ["CONNECT", "TLS_OK", "TLS_FAIL", "SEND_CREATE", "RECV_CREATED",
          "SEND_EXTEND", "RECV_EXTENDED", "SEND_RELAY_DATA", "RECV_RELAY_DATA",
          "SEND_DESTROY", "RECV_DESTROY", "CIRCUIT_CLOSED", "TIMEOUT"]

DL = {
    ("IDLE", "CONNECT"): "CONNECTING",
    ("CONNECTING", "TLS_OK"): "TLS_HANDSHAKE",
    ("CONNECTING", "TLS_FAIL"): "ERROR",
    ("CONNECTING", "TIMEOUT"): "ERROR",
    ("TLS_HANDSHAKE", "SEND_CREATE"): "CREATE_SENT",
    ("TLS_HANDSHAKE", "TLS_FAIL"): "ERROR",
    ("TLS_HANDSHAKE", "TIMEOUT"): "ERROR",
    ("CREATE_SENT", "RECV_CREATED"): "CIRCUIT_BUILDING",
    ("CREATE_SENT", "TIMEOUT"): "ERROR",
    ("CIRCUIT_BUILDING", "SEND_EXTEND"): "CIRCUIT_BUILDING",
    ("CIRCUIT_BUILDING", "RECV_EXTENDED"): "CIRCUIT_READY",
    ("CIRCUIT_BUILDING", "TIMEOUT"): "ERROR",
    ("CIRCUIT_READY", "SEND_RELAY_DATA"): "TRANSMITTING",
    ("CIRCUIT_READY", "RECV_RELAY_DATA"): "TRANSMITTING",
    ("CIRCUIT_READY", "SEND_DESTROY"): "CLOSING",
    ("CIRCUIT_READY", "RECV_DESTROY"): "CLOSING",
    ("CIRCUIT_READY", "TIMEOUT"): "ERROR",
    ("TRANSMITTING", "SEND_RELAY_DATA"): "TRANSMITTING",
    ("TRANSMITTING", "RECV_RELAY_DATA"): "TRANSMITTING",
    ("TRANSMITTING", "SEND_DESTROY"): "CLOSING",
    ("TRANSMITTING", "RECV_DESTROY"): "CLOSING",
    ("TRANSMITTING", "TIMEOUT"): "ERROR",
    ("CLOSING", "CIRCUIT_CLOSED"): "CLOSED",
    ("CLOSING", "TIMEOUT"): "CLOSED",
    ("ERROR", "CIRCUIT_CLOSED"): "CLOSED",
}
VALID = list(DL)  # insertion order == Object.keys(VALID) in fsm.ts
INV = [(s, e) for s in STATES for e in EVENTS if (s, e) not in DL]
assert len(VALID) == 25 and len(INV) == 105

# --------------------------------------------------------------------------
# Preliminary (pre-triage) classification function: port of classifyInvalid()
# --------------------------------------------------------------------------
SEV2P = {"LOW": "P1", "MEDIUM": "P2", "HIGH": "P3", "CRITICAL": "P4"}
FAM_CODE = {"CIRCUIT_BYPASS": "BYPS", "HANDSHAKE_SKIP": "HSKP", "PREMATURE_DATA": "PDAT",
            "GHOST_CIRCUIT": "GHST", "REPLAY_ATTACK": "REPL", "CREATE_FLOOD": "CFLD",
            "CIRCUIT_HIJACK": "HIJK"}


def classify_invalid(state, event):
    data = event in ("SEND_RELAY_DATA", "RECV_RELAY_DATA")
    create = event in ("SEND_CREATE", "RECV_CREATED")
    extend = event in ("SEND_EXTEND", "RECV_EXTENDED")
    destroy = event in ("SEND_DESTROY", "RECV_DESTROY")
    dead = state in ("CLOSED", "ERROR")
    if data:
        if state in ("IDLE", "CONNECTING"): return "CIRCUIT_BYPASS", "CRITICAL"
        if state == "TLS_HANDSHAKE": return "HANDSHAKE_SKIP", "HIGH"
        if state in ("CREATE_SENT", "CIRCUIT_BUILDING"): return "PREMATURE_DATA", "HIGH"
        if state == "CLOSING": return "PREMATURE_DATA", "MEDIUM"
        if state == "CLOSED":
            return ("GHOST_CIRCUIT", "HIGH") if event == "RECV_RELAY_DATA" else ("REPLAY_ATTACK", "CRITICAL")
        if state == "ERROR": return "GHOST_CIRCUIT", "HIGH"
    if create:
        if state == "CREATE_SENT": return "CREATE_FLOOD", "MEDIUM"
        if state == "IDLE" and event == "RECV_CREATED": return "GHOST_CIRCUIT", "HIGH"
        if state == "IDLE" and event == "SEND_CREATE": return "HANDSHAKE_SKIP", "HIGH"
        if state == "CONNECTING": return "HANDSHAKE_SKIP", "HIGH"
        if state == "TLS_HANDSHAKE" and event == "RECV_CREATED": return "CIRCUIT_HIJACK", "LOW"
        if state in ("CIRCUIT_BUILDING", "CIRCUIT_READY", "TRANSMITTING"): return "CIRCUIT_HIJACK", "CRITICAL"
        if state == "CLOSING": return "REPLAY_ATTACK", "HIGH"
        if dead: return "REPLAY_ATTACK", "HIGH"
    if extend:
        if state in ("CIRCUIT_READY", "TRANSMITTING"): return "CIRCUIT_HIJACK", "CRITICAL"
        if dead: return "REPLAY_ATTACK", "HIGH"
        if state in ("IDLE", "CONNECTING", "TLS_HANDSHAKE", "CREATE_SENT"): return "HANDSHAKE_SKIP", "MEDIUM"
        if state == "CLOSING": return "REPLAY_ATTACK", "MEDIUM"
    if destroy:
        if dead or state == "CLOSING": return "GHOST_CIRCUIT", "MEDIUM"
        return "REPLAY_ATTACK", "MEDIUM"
    if event == "CONNECT" and state != "IDLE":
        return ("REPLAY_ATTACK", "MEDIUM") if dead else ("CREATE_FLOOD", "LOW")
    if event == "TLS_OK" and state != "CONNECTING": return "GHOST_CIRCUIT", "MEDIUM"
    if event == "TLS_FAIL": return "GHOST_CIRCUIT", "LOW"
    if event == "CIRCUIT_CLOSED": return "GHOST_CIRCUIT", "LOW"
    if event == "TIMEOUT": return "GHOST_CIRCUIT", "LOW"
    return "INVALID_TRANSITION", "LOW"


# --------------------------------------------------------------------------
# Five-step triage (Section 3.5).  Decision rules are explicit and per pair.
# --------------------------------------------------------------------------
NO_LINK = {"IDLE", "CONNECTING"}                 # no OR link exists yet
NO_CIRCUIT = {"TLS_HANDSHAKE"}                   # link open, no circuit yet
IN_SETUP = {"CREATE_SENT", "CIRCUIT_BUILDING"}   # circuit being created / extended
ESTABLISHED = {"CIRCUIT_READY", "TRANSMITTING"}
TORN_DOWN = {"CLOSING", "CLOSED", "ERROR"}
WIRE = {"SEND_CREATE", "RECV_CREATED", "SEND_EXTEND", "RECV_EXTENDED",
        "SEND_RELAY_DATA", "RECV_RELAY_DATA", "SEND_DESTROY", "RECV_DESTROY"}
LOCAL = {"TLS_OK", "CIRCUIT_CLOSED", "TIMEOUT"}

# Classes
U, REV, CN, SR = "Unreachable", "Model revision", "Conformance-negative", "Security-relevant candidate"


def triage(s, e):
    """Return (class, reason_code, short reason). Applies steps 1-4 in order."""
    assert (s, e) not in DL
    # ---- step 1: interface reachability (three actors of the threat model) ----
    if e in WIRE and s in NO_LINK:
        return U, "U1", "cell on a link that does not exist yet"
    if e in LOCAL:
        return U, "U2", "local stack/timer event outside the condition that produces it"
    if e == "TLS_FAIL" and s == "IDLE":
        return U, "U1", "link failure without a link"
    # ---- step 2: documented precondition (pairs the specification permits) ----
    if e == "CONNECT":
        return REV, "R1", "a further OR connection or a new lifecycle is permitted; single-instance abstraction"
    if e == "TLS_FAIL":
        return REV, "R2", "the relay may close the OR link at any time; link loss modeled only before CREATE2"
    if e in ("SEND_DESTROY", "RECV_DESTROY") and s in IN_SETUP:
        return REV, "R3", "either side may tear a circuit down during construction"
    if e == "RECV_DESTROY" and s == "CLOSING":
        return REV, "R4", "DESTROY cells may cross; a DESTROY can arrive after one was sent"
    if e == "SEND_EXTEND" and s in ESTABLISHED:
        return REV, "R5", "an open circuit may be extended by a further hop (e.g., cannibalization)"
    if e == "SEND_CREATE" and s in ("CLOSED", "ERROR"):
        return REV, "R6", "a new circuit may be created on a link after the modeled circuit is gone"
    # ---- steps 3-4: actor capability (always met for wire events on an open link)
    #      and security rationale ----
    if s in NO_CIRCUIT:
        return CN, "C1", "cell refers to a circuit that does not exist; specified handling is to drop it"
    if e in ("SEND_CREATE", "RECV_CREATED", "SEND_EXTEND", "RECV_EXTENDED", "SEND_DESTROY", "RECV_DESTROY") \
            and s in TORN_DOWN:
        return CN, "C2", "control cell for a circuit that is being or has been torn down; dropped"
    if e in ("SEND_CREATE", "RECV_CREATED", "SEND_EXTEND", "RECV_EXTENDED") and s in IN_SETUP | ESTABLISHED:
        if e == "SEND_CREATE" and s == "CREATE_SENT":
            return SR, "S3", "second CREATE2 while the first is pending: relay-side resource allocation"
        return SR, "S1", "would bind key material or a hop outside the matching setup step"
    if e in ("SEND_RELAY_DATA", "RECV_RELAY_DATA") and (s in IN_SETUP or s in TORN_DOWN):
        return SR, "S2", "relay data on a circuit that is not yet established or already torn down"
    raise ValueError((s, e))


# Final family codes for security-relevant candidates (preliminary label, with
# "replay-style" merged into ghost circuit: a cell produced by the client itself
# is not a replay, cf. reviewer 2, point 3).
def final_family(s, e):
    fam, sev = classify_invalid(s, e)
    code = FAM_CODE[fam]
    if code == "REPL":
        code = "GHST"
    return code, SEV2P[sev]


# --------------------------------------------------------------------------
# PRNG, BFS, run bookkeeping
# --------------------------------------------------------------------------
def mulberry32(a):
    a &= 0xFFFFFFFF

    def imul(x, y):
        return ((x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)) & 0xFFFFFFFF

    def rng():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rng


def shuffle(arr, rng):
    arr = list(arr)
    for i in range(len(arr) - 1, 0, -1):
        j = int(rng() * (i + 1))
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def bfs(src, dst, delta=DL):
    """Shortest event path src->dst; BFS expands events in EVENTS order (as in baselines.mjs)."""
    if src == dst:
        return []
    prev = {src: None}
    q = deque([src])
    while q:
        u = q.popleft()
        for e in EVENTS:
            v = delta.get((u, e))
            if v is not None and v not in prev:
                prev[v] = (u, e)
                if v == dst:
                    path, x = [], v
                    while prev[x]:
                        path.append(prev[x][1])
                        x = prev[x][0]
                    return path[::-1]
                q.append(v)
    return None


class Run:
    """Executes abstract events against the specification FSM under a budget.

    reset_cost: number of budget units charged for a return to IDLE (0 = free,
    as in the original configuration; 1 = charged reset)."""

    def __init__(self, B, reset_cost=0):
        self.B, self.used, self.rc = B, 0, reset_cost
        self.VS, self.VT, self.VI = {"IDLE"}, set(), set()
        self.st = "IDLE"
        self.seq = []
        self.resets = 0

    def reset(self):
        if self.st == "IDLE":
            return True
        if self.used + self.rc > self.B:
            self.used = self.B
            return False
        self.used += self.rc
        self.resets += 1
        self.seq.append("RESET")
        self.st = "IDLE"
        return True

    def step(self, e):
        if self.used >= self.B:
            return False
        self.used += 1
        self.seq.append(e)
        nxt = DL.get((self.st, e))
        if nxt is None:
            self.VI.add((self.st, e))
        else:
            self.VT.add((self.st, e))
            self.st = nxt
            self.VS.add(nxt)
        return True

    def run_seq(self, seq):
        """Reset, then execute seq; returns False if the budget ran out."""
        if not self.reset():
            return False
        for x in seq:
            if not self.step(x):
                return False
        return True


# --------------------------------------------------------------------------
# Strategies.  reset policy:
#   "orig"    : baselines reset (free) on reaching CLOSED; planned sequences reset free
#   "charged" : same reset triggers, every reset costs one budget unit, for all strategies
#   "shared"  : charged resets, and the baselines may also choose RESET as an action
#               (Random: 14th action drawn uniformly; GreedySC: RESET when no valid event
#               leads to an unvisited state and an unvisited state is reachable from IDLE)
# --------------------------------------------------------------------------
def random_testing(seed, B, policy="orig"):
    rng = mulberry32(seed)
    R = Run(B, reset_cost=0 if policy == "orig" else 1)
    acts = EVENTS + (["RESET"] if policy == "shared" else [])
    while R.used < R.B:
        if R.st == "CLOSED":
            if not R.reset():
                break
            continue
        a = acts[int(rng() * len(acts))]
        if a == "RESET":
            if not R.reset():
                break
        else:
            R.step(a)
    return R


def greedy_sc(seed, B, policy="orig", thr=0.3):
    rng = mulberry32(seed)
    R = Run(B, reset_cost=0 if policy == "orig" else 1)
    while R.used < R.B:
        if R.st == "CLOSED":
            if not R.reset():
                break
            continue
        val = [e for e in EVENTS if (R.st, e) in DL]
        inv = [e for e in EVENTS if (R.st, e) not in DL]
        un = [e for e in val if DL[(R.st, e)] not in R.VS]
        if un:
            e = un[int(rng() * len(un))]
        elif policy == "shared" and R.st != "IDLE" and len(R.VS) < len(STATES):
            if not R.reset():
                break
            continue
        elif rng() > thr and val:
            e = val[int(rng() * len(val))]
        else:
            e = inv[int(rng() * len(inv))]
        R.step(e)
    return R


def mdt(seed, B, policy="orig", uio=None):
    rng = mulberry32(seed)
    R = Run(B, reset_cost=0 if policy == "orig" else 1)
    done = set()
    for (s, e) in shuffle(VALID, rng):
        if R.used >= R.B:
            break
        if (s, e) in (done if uio else R.VT):
            continue
        p = bfs("IDLE", s)
        if p is None:
            continue
        tail = list(uio[DL[(s, e)]]) if uio else []
        if R.run_seq(p + [e] + tail):
            done.add((s, e))
    for (s, e) in shuffle(INV, rng):
        if R.used >= R.B:
            break
        if (s, e) in R.VI:
            continue
        p = bfs("IDLE", s)
        if p is None:
            continue
        R.run_seq(p + [e])
    return R


# --------------------------------------------------------------------------
# Observational semantics: accept (1) / reject (0) per event; undefined -> stay
# --------------------------------------------------------------------------
def out_seq(st, seq, delta=DL):
    o = []
    for e in seq:
        n = delta.get((st, e))
        if n is None:
            o.append(0)
        else:
            o.append(1)
            st = n
    return tuple(o)


def replay(seq, delta):
    st, obs = "IDLE", []
    for x in seq:
        if x == "RESET":
            st = "IDLE"
            continue
        n = delta.get((st, x))
        if n is None:
            obs.append(0)
        else:
            obs.append(1)
            st = n
    return obs


def equivalence_classes():
    """Partition refinement (Moore) on the complete accept/reject Mealy machine."""
    part = {s: tuple((s, e) in DL for e in EVENTS) for s in STATES}
    while True:
        new = {s: (part[s],) + tuple(part[DL.get((s, e), s)] for e in EVENTS) for s in STATES}
        if len(set(new.values())) == len(set(part.values())):
            break
        part = new
    classes = {}
    for s in STATES:
        classes.setdefault(part[s], []).append(s)
    return list(classes.values())


def unique_io():
    """Shortest input sequence separating each state from all non-equivalent states."""
    cls = equivalence_classes()
    eqv = {s: set(c) for c in cls for s in c}
    U_ = {}
    for t in STATES:
        others = [s for s in STATES if s not in eqv[t]]
        found = None
        for L in range(1, 5):
            for seq in itertools.product(EVENTS, repeat=L):
                o = out_seq(t, seq)
                if all(out_seq(s, seq) != o for s in others):
                    found = seq
                    break
            if found:
                break
        U_[t] = found
    return U_


def characterization_set():
    """Small W set: greedily chosen sequences that pairwise separate all inequivalent states."""
    cls = equivalence_classes()
    reps = [c[0] for c in cls]
    pairs = [(a, b) for a, b in itertools.combinations(reps, 2)]
    cand = [seq for L in (1, 2, 3) for seq in itertools.product(EVENTS, repeat=L)]
    W = []
    remaining = set(pairs)
    while remaining:
        best, bestc = None, -1
        for seq in cand:
            c = sum(1 for (a, b) in remaining if out_seq(a, seq) != out_seq(b, seq))
            if c > bestc:
                best, bestc = seq, c
        if bestc <= 0:
            raise RuntimeError("cannot separate")
        W.append(best)
        remaining = {(a, b) for (a, b) in remaining if out_seq(a, best) == out_seq(b, best)}
    return W


def state_cover():
    """Access sequences (BFS from IDLE) for each state."""
    return {s: bfs("IDLE", s) for s in STATES}


def transition_cover():
    """P = {access(s)} U {access(s).e : s in S, e in Sigma} (complete machine)."""
    acc = state_cover()
    P = [tuple(acc[s]) for s in STATES]
    P += [tuple(acc[s]) + (e,) for s in STATES for e in EVENTS]
    return P


def target_after(seq):
    st = "IDLE"
    for e in seq:
        st = DL.get((st, e), st)
    return st


def w_method_suite():
    W = characterization_set()
    P = transition_cover()
    suite = {p + w for p in P for w in W}
    # remove sequences that are proper prefixes of others (they add no observations)
    suite = sorted(suite, key=lambda x: (len(x), x))
    full = set(suite)
    keep = [s for s in suite if not any(t[:len(s)] == s and len(t) > len(s) for t in full)]
    return keep, W


def wp_method_suite():
    """Wp: state cover x W  +  (P minus state cover) x W_i (identification set of the reached state)."""
    W = characterization_set()
    cls = equivalence_classes()
    eqv = {s: set(c) for c in cls for s in c}
    acc = state_cover()
    Q = {tuple(acc[s]) for s in STATES}
    P = transition_cover()
    Wi = {}
    for t in STATES:
        need = {s for s in STATES if s not in eqv[t]}
        chosen = []
        for w in W:
            sep = {s for s in need if out_seq(s, w) != out_seq(t, w)}
            if sep:
                chosen.append(w)
                need -= sep
            if not need:
                break
        Wi[t] = chosen
    suite = {q + w for q in Q for w in W}
    for p in P:
        if p in Q:
            continue
        for w in Wi[target_after(p)]:
            suite.add(p + w)
    suite = sorted(suite, key=lambda x: (len(x), x))
    full = set(suite)
    keep = [s for s in suite if not any(t[:len(s)] == s and len(t) > len(s) for t in full)]
    return keep


def uio_method_suite(uio):
    """UIO method: for every transition (s,e) of the complete machine, access(s).e.UIO(target)."""
    acc = state_cover()
    suite = []
    for s in STATES:
        for e in EVENTS:
            t = DL.get((s, e), s)
            suite.append(tuple(acc[s]) + (e,) + tuple(uio[t]))
    return suite


def run_suite(suite, seed, B, policy="orig"):
    """Execute a precomputed suite in seeded random order under the budget."""
    rng = mulberry32(seed)
    R = Run(B, reset_cost=0 if policy == "orig" else 1)
    for seq in shuffle(suite, rng):
        if R.used >= R.B:
            break
        R.run_seq(list(seq))
    return R


# --------------------------------------------------------------------------
# Mutants
# --------------------------------------------------------------------------
def mutants():
    out = []
    for (s, e), t in DL.items():
        d = dict(DL)
        del d[(s, e)]
        out.append(("missing transition", (s, e), None, d))
        for t2 in STATES:
            if t2 != t:
                d = dict(DL)
                d[(s, e)] = t2
                out.append(("wrong target state", (s, e), t2, d))
    for (s, e) in INV:
        for t2 in STATES:
            d = dict(DL)
            d[(s, e)] = t2
            out.append(("extra transition", (s, e), t2, d))
    return out


def observationally_equal(delta2):
    seen = {("IDLE", "IDLE")}
    q = deque(seen)
    while q:
        a, b = q.popleft()
        for e in EVENTS:
            x, y = DL.get((a, e)), delta2.get((b, e))
            if (x is None) != (y is None):
                return False
            if x is not None and (x, y) not in seen:
                seen.add((x, y))
                q.append((x, y))
    return True


LIVE = None


def live_mutants():
    global LIVE
    if LIVE is None:
        LIVE = [m for m in mutants() if not observationally_equal(m[3])]
    return LIVE


def kills(seq, live=None):
    live = live or live_mutants()
    ref = replay(seq, DL)
    return [replay(seq, m[3]) != ref for m in live]
