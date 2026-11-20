import numpy as np, csv
from torfsm import *
from fastkill import kill_profile
UIO=unique_io(); WS,_=w_method_suite(); WPS=wp_method_suite(); US=uio_method_suite(UIO)
S={"Random Testing (B1)":lambda s,B: random_testing(s,B),"GreedySC (B2)":lambda s,B: greedy_sc(s,B),
"MDT (B3)":lambda s,B: mdt(s,B),"MDT + state verification (B4)":lambda s,B: mdt(s,B,uio=UIO),
"W-method":lambda s,B: run_suite(WS,s,B),"Wp-method":lambda s,B: run_suite(WPS,s,B),"UIO method":lambda s,B: run_suite(US,s,B)}
rows=[]
for B in (50,100,250,500,750,1000,1500,2000,3000):
  for n,f in S.items():
    v=[]
    for s in range(1000,1030):
      R=f(s,B); m,w,x=kill_profile(R); v.append([100*m/25,100*w/220,100*x/1050,100*(m+w+x)/1295])
    v=np.array(v); rows.append([B,n]+list(v.mean(0).round(2))+list(v.std(0,ddof=1).round(2)))
with open("out/budget_curves.csv","w",newline="") as fh:
  w=csv.writer(fh); w.writerow(["budget","strategy","TC","WT","ITDR","ALL","TC_sd","WT_sd","ITDR_sd","ALL_sd"]); w.writerows(rows)
# events needed for a complete suite (free reset)
for n,f in [("MDT (B3)",lambda: mdt(1000,10**6)),("B4",lambda: mdt(1000,10**6,uio=UIO)),("W",lambda: run_suite(WS,1000,10**6)),("Wp",lambda: run_suite(WPS,1000,10**6)),("UIO",lambda: run_suite(US,1000,10**6))]:
  R=f(); print(n,"events",R.used,"resets",R.resets)
# smallest budget at which all 30 seeds reach 100% overall
for n,f in [("B4",lambda s,B: mdt(s,B,uio=UIO)),("UIO",lambda s,B: run_suite(US,s,B)),("Wp",lambda s,B: run_suite(WPS,s,B)),("W",lambda s,B: run_suite(WS,s,B))]:
  for B in range(500,3001,10):
    if all(sum(kill_profile(f(s,B)))==1295 for s in range(1000,1030)): print(n,"all seeds 100% at",B); break
