import csv, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Patch
from torfsm import *
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.spines.top":False,"axes.spines.right":False,"savefig.dpi":600})
NAVY="#213a57"; INK="#1b2430"; GREY="#6b7280"
OUT="../figures/"
# ---------------- Fig 3: triage matrix ----------------
TRI={p:triage(*p) for p in INV}
CC={U:"#e5e7eb",REV:"#bcd2e8",CN:"#f6dfb8",SR:"#b85c1e"}
TXT={U:GREY,REV:"#1f3d5c",CN:"#7a4a10",SR:"white"}
ABBR={"CONNECTING":"CONN","TLS_HANDSHAKE":"TLS_HS","CREATE_SENT":"CR_SENT","CIRCUIT_BUILDING":"BUILD","CIRCUIT_READY":"READY","TRANSMITTING":"TRANS","CLOSING":"CLOSING","CLOSED":"CLOSED","ERROR":"ERROR"}
fig,ax=plt.subplots(figsize=(7.2,4.9))
cw,ch=1.0,0.62
for i,s in enumerate(STATES):
  for j,e in enumerate(EVENTS):
    x,y=j*cw,-i*ch
    if (s,e) in DL:
      col,lab,tc,c=NAVY,ABBR[DL[(s,e)]],"white",None
    else:
      c,r,_=TRI[(s,e)]; col,tc=CC[c],TXT[c]
      lab = (final_family(s,e)[0]+"\n"+final_family(s,e)[1]) if c==SR else r
    ax.add_patch(FancyBboxPatch((x+0.04,y-ch+0.05),cw-0.08,ch-0.1,boxstyle="round,pad=0,rounding_size=0.06",fc=col,ec="none"))
    ax.text(x+cw/2,y-ch/2,lab,ha="center",va="center",fontsize=5.0,linespacing=0.95,color=tc,fontweight="bold" if c==SR and (s,e) not in DL else "normal")
for i,s in enumerate(STATES): ax.text(-0.08,-i*ch-ch/2,s,ha="right",va="center",fontsize=6.6,color=INK)
for j,e in enumerate(EVENTS): ax.text(j*cw+cw/2,0.08,e,ha="left",va="bottom",rotation=45,fontsize=6.3,color=INK,rotation_mode="anchor")
ax.set_xlim(-2.6,13.1); ax.set_ylim(-10*ch-0.1,1.9); ax.axis("off")
n={c:sum(1 for v in TRI.values() if v[0]==c) for c in CC}
hand=[Patch(fc=NAVY,label="valid transition (next state)")]+[Patch(fc=CC[c],label=f"{c} ({n[c]})") for c in (U,REV,CN,SR)]
ax.legend(handles=hand,loc="upper center",bbox_to_anchor=(0.5,0.0),ncol=3,frameon=False,fontsize=6.4,handlelength=1.2,columnspacing=1.0)
fig.savefig(OUT+"Fig3.png",bbox_inches="tight"); fig.savefig(OUT+"Fig3.pdf",bbox_inches="tight"); plt.close(fig)

# ---------------- data ----------------
R=list(csv.DictReader(open("out/model_results.csv")))
def get(pol,B,st,k): 
  x=[r for r in R if r["policy"]==pol and r["budget"]==str(B) and r["strategy"]==st][0]; return float(x[k+"_mean"]),float(x[k+"_sd"])
ORDER=["Random Testing (B1)","GreedySC (B2)","MDT (B3)","MDT + state verification (B4)","W-method","Wp-method","UIO method"]
SHORT={"Random Testing (B1)":"Random (B1)","GreedySC (B2)":"GreedySC (B2)","MDT (B3)":"MDT (B3)","MDT + state verification (B4)":"MDT+SV (B4)","W-method":"W-method","Wp-method":"Wp-method","UIO method":"UIO method"}
COL={"Random Testing (B1)":"#9aa5b1","GreedySC (B2)":"#5b8db8","MDT (B3)":NAVY,"MDT + state verification (B4)":"#c2410c","W-method":"#7c6aa8","Wp-method":"#3f8f6b","UIO method":"#d4a017"}
MK={"Random Testing (B1)":"o","GreedySC (B2)":"s","MDT (B3)":"D","MDT + state verification (B4)":"^","W-method":"v","Wp-method":"P","UIO method":"X"}
# ---------------- Fig 5: flagged pairs by triage class (500 events) ----------------
fig,ax=plt.subplots(figsize=(6.6,2.9))
cls=[("fl_SR",SR),("fl_CN",CN),("fl_REV",REV),("fl_U",U)]
strs=ORDER[:3]; y=np.arange(len(strs))[::-1]
left=np.zeros(len(strs))
for k,c in cls:
  v=np.array([get("orig",500,s,k)[0] for s in strs])
  ax.barh(y,v,left=left,color=CC[c],edgecolor="white",height=0.6,label=c)
  for yi,l,vi in zip(y,left,v):
    if vi>4: ax.text(l+vi/2,yi,f"{vi:.1f}",ha="center",va="center",fontsize=7,color=TXT[c])
  left+=v
for yi,t in zip(y,left): ax.text(t+1,yi,f"{t:.1f}",va="center",fontsize=7.5,color=INK,fontweight="bold")
ax.set_yticks(y); ax.set_yticklabels([SHORT[s] for s in strs]); ax.set_xlim(0,112)
ax.set_xlabel("Undefined pairs flagged per run (mean over 30 seeds, 500 events; of 105)")
ax.legend(ncol=4,frameon=False,fontsize=6.8,loc="upper center",bbox_to_anchor=(0.5,1.2))
fig.savefig(OUT+"Fig5.png",bbox_inches="tight"); fig.savefig(OUT+"Fig5.pdf",bbox_inches="tight"); plt.close(fig)

# ---------------- Fig 6: kill rates by class at 500 ----------------
fig,axs=plt.subplots(1,4,figsize=(7.2,2.9),sharey=True)
keys=[("kill_missing","Missing transition (25)\n= transition coverage"),("kill_extra","Extra transition (1050)\n= model-oracle ITDR"),
      ("kill_wrongtarget","Wrong target state (220)\nnot reducible to coverage"),("kill_all","All mutants (1295)")]
yy=np.arange(len(ORDER))[::-1]
for ax,(k,t) in zip(axs,keys):
  m=[get("orig",500,s,k) for s in ORDER]
  ax.barh(yy,[a for a,_ in m],xerr=[b for _,b in m],color=[COL[s] for s in ORDER],height=0.65,error_kw=dict(lw=0.7,capsize=1.5,ecolor=GREY))
  for yi,(a,b) in zip(yy,m): ax.text(min(a+b,104)+2,yi,f"{a:.1f}",va="center",fontsize=6.2)
  ax.set_title(t,fontsize=7,color=INK,fontweight="bold" if k=="kill_wrongtarget" else "normal"); ax.set_xlim(0,128); ax.set_xticks([0,50,100])
  ax.tick_params(labelsize=6.5)
axs[0].set_yticks(yy); axs[0].set_yticklabels([SHORT[s] for s in ORDER],fontsize=7)
fig.supxlabel("Mutants killed (%), mean ± SD over 30 paired seeds, 500 events",fontsize=7.5)
fig.tight_layout(); fig.savefig(OUT+"Fig6.png",bbox_inches="tight"); fig.savefig(OUT+"Fig6.pdf",bbox_inches="tight"); plt.close(fig)

# ---------------- Fig 7: budget curves ----------------
C=list(csv.DictReader(open("out/budget_curves.csv")))
fig,axs=plt.subplots(1,3,figsize=(7.2,2.7),sharey=True)
for ax,(k,t) in zip(axs,[("TC","(a) Transition coverage\n= missing-transition kill"),("ITDR","(b) Model-oracle ITDR\n= extra-transition kill"),("WT","(c) Wrong-target-state kill")]):
  for s in ORDER:
    pts=[(int(r["budget"]),float(r[k])) for r in C if r["strategy"]==s]
    ax.plot([p[0] for p in pts],[p[1] for p in pts],marker=MK[s],ms=3,lw=1.1,color=COL[s],label=SHORT[s])
  ax.set_xscale("log"); ax.set_xticks([50,100,250,500,1000,3000]); ax.set_xticklabels(["50","100","250","500","1000","3000"],fontsize=6.5)
  ax.axvline(500,color=GREY,lw=0.6,ls=":"); ax.set_title(t,fontsize=7.2); ax.set_ylim(-3,104); ax.tick_params(labelsize=6.5)
axs[0].set_ylabel("% (mean over 30 seeds)",fontsize=7)
fig.supxlabel("Event budget per run (log scale; dotted line: main configuration)",fontsize=7.5)
h,l=axs[0].get_legend_handles_labels(); fig.legend(h,l,ncol=7,frameon=False,fontsize=6.2,loc="upper center",bbox_to_anchor=(0.5,1.08),handlelength=1.5,columnspacing=0.8)
fig.tight_layout(); fig.savefig(OUT+"Fig7.png",bbox_inches="tight"); fig.savefig(OUT+"Fig7.pdf",bbox_inches="tight"); plt.close(fig)
print("ok")
