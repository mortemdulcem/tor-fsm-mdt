import numpy as np, csv
from torfsm import *
def met(R): return (100*len(R.VS)/10, 100*len(R.VT)/25, 100*len(R.VI)/105)
strats=[("B1",random_testing),("B2",greedy_sc),("B3",mdt)]
print("Table 9 check (30 seeds, 500)")
for n,f in strats:
    m=np.array([met(f(s,500)) for s in range(1000,1030)])
    print(n, m.mean(0).round(1), m.std(0,ddof=1).round(1), "flagged", (m[:,2]*1.05).mean().round(1))
print("Table C1 check (100 seeds)")
for B in (50,100,250,500,1000,2000):
    row=[]
    for n,f in strats:
        v=np.array([met(f(s,B))[2] for s in range(1000,1100)])
        row.append(f"{v.mean():.2f}±{v.std(ddof=1):.2f}")
    print(B,row)
live=live_mutants(); print("live mutants",len(live))
import collections; print(collections.Counter(m[0] for m in live))
print(equivalence_classes())
print(unique_io())
