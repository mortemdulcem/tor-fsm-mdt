"""Model-fidelity checks for reviewer 1 (point 1) and reviewer 2 (points 3, 5).
(a) ordering properties checked exactly on the abstraction A by product with monitors;
(b) hop-explicit refinement R (three-hop circuit) and shortest sequences on which A and R disagree."""
from collections import deque
from torfsm import DL, STATES, EVENTS
import json

A = dict(DL)
# ---------- hop-explicit refinement R ----------
R = {}
for (s,e),t in DL.items():
    if s=="CIRCUIT_BUILDING": continue
    R[(s,e)] = "H1" if t=="CIRCUIT_BUILDING" else t
R[("H1","SEND_EXTEND")]="X1"; R[("X1","RECV_EXTENDED")]="H2"
R[("H2","SEND_EXTEND")]="X2"; R[("X2","RECV_EXTENDED")]="CIRCUIT_READY"
for h in ("H1","X1","H2","X2"): R[(h,"TIMEOUT")]="ERROR"
RS = STATES[:4]+["H1","X1","H2","X2"]+STATES[5:]
H = {s:("CIRCUIT_BUILDING" if s in ("H1","X1","H2","X2") else s) for s in RS}
# sanity: R refines A on the shared events except the hop guard
def shortest_diff(M1, M2, maxlen=12):
    """Shortest event sequences all-accepted by M1 and not by M2 (first rejection at the end)."""
    out=[]; seen={("IDLE","IDLE")}; q=deque([("IDLE","IDLE",())])
    while q:
        a,b,p=q.popleft()
        if len(p)>=maxlen: continue
        for e in EVENTS:
            na=M1.get((a,e)); nb=M2.get((b,e))
            if na is None: continue
            if nb is None:
                out.append(p+(e,)); continue
            if (na,nb) not in seen:
                seen.add((na,nb)); q.append((na,nb,p+(e,)))
    return out
over = shortest_diff(A,R)   # accepted by A, rejected by R
# ---------- properties (monitors with saturating counters) ----------
def check(M, prop, maxstate=4):
    """BFS over M x monitor; returns shortest violating accepted trace or None."""
    start=("IDLE",prop["init"]); seen={start}; q=deque([(start,())])
    while q:
        (s,m),p=q.popleft()
        for e in EVENTS:
            t=M.get((s,e))
            if t is None: continue
            nm,bad=prop["step"](m,s,e,t)
            if bad: return p+(e,)
            if (t,nm) not in seen:
                seen.add((t,nm)); q.append(((t,nm),p+(e,)))
    return None
def mk(init, f): return {"init":init,"step":f}
# monitor memory: dict-free tuples
P = {
 "P1 CREATE2 only after the link handshake": mk(0, lambda m,s,e,t: ((1 if e=="TLS_OK" else m), e=="SEND_CREATE" and m==0)),
 "P2 CREATED2 only after CREATE2":           mk(0, lambda m,s,e,t: ((1 if e=="SEND_CREATE" else m), e=="RECV_CREATED" and m==0)),
 "P3 EXTEND2 only after CREATED2":           mk(0, lambda m,s,e,t: ((1 if e=="RECV_CREATED" else m), e=="SEND_EXTEND" and m==0)),
 "P4 relay data only after the circuit is ready": mk(0, lambda m,s,e,t: ((1 if t=="CIRCUIT_READY" else m), e in ("SEND_RELAY_DATA","RECV_RELAY_DATA") and m==0)),
 "P5 no relay data or circuit cell after DESTROY": mk(0, lambda m,s,e,t: ((1 if e in ("SEND_DESTROY","RECV_DESTROY") else m), m==1 and e in ("SEND_RELAY_DATA","RECV_RELAY_DATA","SEND_CREATE","SEND_EXTEND","RECV_CREATED","RECV_EXTENDED"))),
 "P6 every EXTENDED2 answers an outstanding EXTEND2": mk(0, lambda m,s,e,t: ((min(m+1,3) if e=="SEND_EXTEND" else (m-1 if e=="RECV_EXTENDED" and m>0 else m)), e=="RECV_EXTENDED" and m==0)),
 "P7 at most one EXTEND2 outstanding (hop by hop)": mk(0, lambda m,s,e,t: ((1 if e=="SEND_EXTEND" else (0 if e=="RECV_EXTENDED" else m)), e=="SEND_EXTEND" and m==1)),
 "P8 ready only after the planned number of hops (3)": mk(0, lambda m,s,e,t: ((min(m+1,4) if e in ("RECV_CREATED","RECV_EXTENDED") else m), t=="CIRCUIT_READY" and s!="CIRCUIT_READY" and m+ (1 if e=="RECV_EXTENDED" else 0)!=3)),
}
res={}
for name,p in P.items():
    va=check(A,p); vr=check(R,p)
    res[name]={"abstraction":"holds" if va is None else "violated: "+" ".join(va),
               "refinement":"holds" if vr is None else "violated: "+" ".join(vr)}
for k,v in res.items(): print(k,"\n   A:",v["abstraction"],"\n   R:",v["refinement"])
# spec-permitted sequences rejected by A (from triage rules R2-R6), witnessed
acc={"CREATE_SENT":["CONNECT","TLS_OK","SEND_CREATE"],"CIRCUIT_BUILDING":["CONNECT","TLS_OK","SEND_CREATE","RECV_CREATED"],
     "CIRCUIT_READY":["CONNECT","TLS_OK","SEND_CREATE","RECV_CREATED","RECV_EXTENDED"]}
print("\nshortest A-accepted / R-rejected sequences (up to length 7):")
for s in sorted(over,key=len)[:8]: print("  "," ".join(s))
json.dump({"properties":res,"over_accepted":[" ".join(s) for s in sorted(over,key=len)[:10]]},open("out/fidelity.json","w"),indent=1)
