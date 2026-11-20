"""Produces every model-level number of the revised manuscript (CSV in out/)."""
import numpy as np, csv, os, json, collections
from torfsm import *
from fastkill import kill_profile
os.makedirs("out", exist_ok=True)
UIO = unique_io(); WS,_ = w_method_suite(); WPS = wp_method_suite(); US = uio_method_suite(UIO)
TRI = {p: triage(*p) for p in INV}
SRP = {p for p,v in TRI.items() if v[0]==SR}
STRATS = {
 "Random Testing (B1)": lambda s,B,pol: random_testing(s,B,pol),
 "GreedySC (B2)":       lambda s,B,pol: greedy_sc(s,B,pol),
 "MDT (B3)":            lambda s,B,pol: mdt(s,B,pol),
 "MDT + state verification (B4)": lambda s,B,pol: mdt(s,B,pol,uio=UIO),
 "W-method":            lambda s,B,pol: run_suite(WS,s,B,pol),
 "Wp-method":           lambda s,B,pol: run_suite(WPS,s,B,pol),
 "UIO method":          lambda s,B,pol: run_suite(US,s,B,pol),
}
SEEDS = range(1000,1030)
rows=[]
for pol in ("orig","charged","shared"):
  for B in (50,100,250,500,1000,2000,3000):
    for name,f in STRATS.items():
      if pol=="shared" and name not in ("Random Testing (B1)","GreedySC (B2)"): continue
      vals=[]
      for s in SEEDS:
        R=f(s,B,pol); m,w,x=kill_profile(R)
        cls=collections.Counter(TRI[p][0] for p in R.VI)
        vals.append([100*len(R.VS)/10,100*len(R.VT)/25,100*len(R.VI)/105,
                     100*m/25,100*w/220,100*x/1050,100*(m+w+x)/1295,
                     100*len(R.VI & SRP)/len(SRP), R.resets, len(R.VI),
                     cls[U],cls[REV],cls[CN],cls[SR]])
      v=np.array(vals,float)
      keys=["SC","TC","ITDR","kill_missing","kill_wrongtarget","kill_extra","kill_all","SR_cov","resets","flagged","fl_U","fl_REV","fl_CN","fl_SR"]
      row={"policy":pol,"budget":B,"strategy":name}
      for i,k in enumerate(keys):
        row[k+"_mean"]=round(v[:,i].mean(),2); row[k+"_sd"]=round(v[:,i].std(ddof=1),2)
      rows.append(row)
with open("out/model_results.csv","w",newline="") as fh:
  w=csv.DictWriter(fh,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
# triage table
with open("out/triage_105.csv","w",newline="") as fh:
  w=csv.writer(fh); w.writerow(["state","event","class","rule","reason","prelim_family","prelim_priority","final_family","final_priority"])
  for (s,e) in INV:
    c,r,why=TRI[(s,e)]; fam,sev=classify_invalid(s,e)
    ff,fp=(final_family(s,e) if c==SR else ("",""))
    w.writerow([s,e,c,r,why,FAM_CODE[fam],SEV2P[sev],ff,fp])
summ={"classes":collections.Counter(v[0] for v in TRI.values()),
      "rules":collections.Counter(v[1] for v in TRI.values()),
      "SR_families":collections.Counter(final_family(*p)[0] for p in SRP),
      "SR_priorities":collections.Counter(final_family(*p)[1] for p in SRP),
      "suite_sizes":{n:(len(s),sum(map(len,s))) for n,s in [("W",WS),("Wp",WPS),("UIO",US)]},
      "W":characterization_set(),"UIO":UIO}
json.dump(summ,open("out/summary.json","w"),indent=1,default=str)
print(json.dumps(summ,indent=1,default=str))
