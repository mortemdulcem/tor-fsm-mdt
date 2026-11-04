"""Fault-detection (mutation) evaluation of the abstract Tor FSM test strategies.

Independent oracle: each test sequence is replayed against single-fault mutants of
the specification FSM; a mutant is killed when the accept/reject trace differs from
the specification trace. This removes the circularity of the model-oracle ITDR,
in which generator and oracle share the same transition function.
"""
import json, itertools, numpy as np
from collections import deque

_f = json.load(open('fsm.json'))
S, E = _f['S'], _f['E']
DL = {tuple(k.split('|')): v for k, v in _f['DL'].items()}
VALID = list(DL)
INV = [(s, e) for s in S for e in E if (s, e) not in DL]
assert len(VALID) == 25 and len(INV) == 105


def mulberry32(a):
    a &= 0xFFFFFFFF
    def imul(x, y): return ((x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)) & 0xFFFFFFFF
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
    if src == dst:
        return []
    prev = {src: None}
    q = deque([src])
    while q:
        u = q.popleft()
        for e in E:
            v = delta.get((u, e))
            if v is not None and v not in prev:
                prev[v] = (u, e)
                q.append(v)
                if v == dst:
                    path, x = [], v
                    while prev[x]:
                        path.append(prev[x][1]); x = prev[x][0]
                    return path[::-1]
    return None


class Run:
    """Executes abstract events against the specification FSM under a budget."""

    def __init__(self, B):
        self.B, self.used = B, 0
        self.VS, self.VT, self.VI = {'IDLE'}, set(), set()
        self.st = 'IDLE'
        self.seq = []

    def reset(self):
        if self.st != 'IDLE':
            self.seq.append('RESET')
        self.st = 'IDLE'

    def step(self, e):
        if self.used >= self.B:
            return False
        self.used += 1
        self.seq.append(e)
        nxt = DL.get((self.st, e))
        if nxt is None:
            self.VI.add((self.st, e))
        else:
            self.VT.add((self.st, e)); self.st = nxt; self.VS.add(nxt)
        return True


def random_testing(seed, B):
    rng, R = mulberry32(seed), Run(B)
    while R.used < B:
        if R.st == 'CLOSED':
            R.reset()
        R.step(E[int(rng() * len(E))])
    return R


def greedy_sc(seed, B, thr=0.3):
    rng, R = mulberry32(seed), Run(B)
    while R.used < B:
        if R.st == 'CLOSED':
            R.reset()
        val = [e for e in E if (R.st, e) in DL]
        inv = [e for e in E if (R.st, e) not in DL]
        un = [e for e in val if DL[(R.st, e)] not in R.VS]
        if un:
            e = un[int(rng() * len(un))]
        elif rng() > thr and val:
            e = val[int(rng() * len(val))]
        else:
            e = inv[int(rng() * len(inv))]
        R.step(e)
    return R


def mdt(seed, B, uio=None):
    """MDT; with uio != None each covered valid transition is followed by the
    unique input-output sequence of its target state (state verification)."""
    rng, R = mulberry32(seed), Run(B)
    done = set()
    for (s, e) in shuffle(VALID, rng):
        if R.used >= B:
            break
        if (s, e) in (done if uio else R.VT):
            continue
        p = bfs('IDLE', s)
        if p is None:
            continue
        R.reset()
        tail = list(uio[DL[(s, e)]]) if uio else []
        ok = True
        for x in p + [e] + tail:
            if not R.step(x):
                ok = False; break
        if ok:
            done.add((s, e))
    for (s, e) in shuffle(INV, rng):
        if R.used >= B:
            break
        if (s, e) in R.VI:
            continue
        p = bfs('IDLE', s)
        if p is None:
            continue
        R.reset()
        for x in p + [e]:
            if not R.step(x):
                break
    return R


def out_seq(st, seq, delta=DL):
    o = []
    for e in seq:
        n = delta.get((st, e))
        if n is None:
            o.append(0)
        else:
            o.append(1); st = n
    return tuple(o)


def unique_io():
    """Shortest input sequence separating each state from all non-equivalent states."""
    eq = {'CIRCUIT_READY': {'CIRCUIT_READY', 'TRANSMITTING'},
          'TRANSMITTING': {'CIRCUIT_READY', 'TRANSMITTING'}}
    U = {}
    for t in S:
        others = [s for s in S if s not in eq.get(t, {t})]
        found = None
        for L in range(1, 4):
            for seq in itertools.product(E, repeat=L):
                o = out_seq(t, seq)
                if all(out_seq(s, seq) != o for s in others):
                    found = seq; break
            if found:
                break
        U[t] = found
    return U


def mutants():
    """Single-fault mutants: missing transition, wrong target, extra transition."""
    out = []
    for (s, e), t in DL.items():
        d = dict(DL); del d[(s, e)]
        out.append(('missing transition', (s, e), None, d))
        for t2 in S:
            if t2 != t:
                d = dict(DL); d[(s, e)] = t2
                out.append(('wrong target state', (s, e), t2, d))
    for (s, e) in INV:
        for t2 in S:
            d = dict(DL); d[(s, e)] = t2
            out.append(('extra transition', (s, e), t2, d))
    return out


def observationally_equal(delta2):
    seen = {('IDLE', 'IDLE')}
    q = deque(seen)
    while q:
        a, b = q.popleft()
        for e in E:
            x, y = DL.get((a, e)), delta2.get((b, e))
            if (x is None) != (y is None):
                return False
            if x is not None and (x, y) not in seen:
                seen.add((x, y)); q.append((x, y))
    return True


def replay(seq, delta):
    st, obs = 'IDLE', []
    for x in seq:
        if x == 'RESET':
            st = 'IDLE'; continue
        n = delta.get((st, x))
        if n is None:
            obs.append(0)
        else:
            obs.append(1); st = n
    return obs


def evaluate(budgets=(250, 500, 1000), seeds=range(1000, 1030)):
    UIO = unique_io()
    live = [m for m in mutants() if not observationally_equal(m[3])]
    cls = np.array([m[0] for m in live])
    strategies = [('Random Testing (B1)', random_testing),
                  ('GreedySC (B2)', greedy_sc),
                  ('MDT (B3)', mdt),
                  ('MDT + state verification (B4)', lambda s, B: mdt(s, B, uio=UIO))]
    rows = []
    for B in budgets:
        for name, fn in strategies:
            met, kill = [], []
            for s in seeds:
                R = fn(s, B)
                met.append((100 * len(R.VS) / len(S), 100 * len(R.VT) / len(VALID),
                            100 * len(R.VI) / len(INV)))
                ref = replay(R.seq, DL)
                kill.append([replay(R.seq, m[3]) != ref for m in live])
            met, kill = np.array(met), np.array(kill)
            row = {'budget': B, 'strategy': name,
                   'SC': met[:, 0], 'TC': met[:, 1], 'ITDR': met[:, 2]}
            for c in ('missing transition', 'wrong target state', 'extra transition'):
                row[c] = kill[:, cls == c].mean(1) * 100
            row['mutation score'] = kill.mean(1) * 100
            rows.append(row)
    return rows, len(live), collections.Counter(cls.tolist()) if (collections := __import__('collections')) else None
