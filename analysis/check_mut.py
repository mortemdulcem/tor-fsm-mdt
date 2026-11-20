import numpy as np
from torfsm import *
from fastkill import kill_profile, WT
live=live_mutants()
n={c:sum(1 for m in live if m[0]==c) for c in ("missing transition","wrong target state","extra transition")}
print(n)
for B in (250,500,1000):
  for name,f in [("B1",random_testing),("B2",greedy_sc),("B3",mdt),("B4",lambda s,B: mdt(s,B,uio=unique_io()))]:
    rows=[]
    for s in range(1000,1030):
        R=f(s,B); a,b,c=kill_profile(R)
        rows.append([100*a/25,100*b/220,100*c/1050,100*(a+b+c)/1295])
    r=np.array(rows); print(B,name,r.mean(0).round(2),r.std(0,ddof=1).round(2))
# exactness check on a few runs vs full replay
import random
for s in (1000,1007):
  for f in (random_testing,mdt):
    R=f(s,500); k=kills(R.seq); full=sum(k); a,b,c=kill_profile(R); assert full==a+b+c,(full,a,b,c)
print("fast == full OK")
