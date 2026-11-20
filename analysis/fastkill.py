from torfsm import *
_live = live_mutants()
WT = [m for m in _live if m[0]=="wrong target state"]
def kill_profile(R):
    """Exact kill counts per class for a run (missing==TC pairs, extra==ITDR pairs, wrong-target simulated)."""
    seq = R.seq
    ref = replay(seq, DL)
    miss = len(R.VT)  # each valid pair exercised kills its missing mutant
    # extra-transition mutants: 10 targets per undefined pair; all non-equivalent -> 10 per exercised pair
    extra = sum(1 for m in _live if m[0]=="extra transition" and m[1] in R.VI)
    wt = sum(1 for m in WT if replay(seq, m[3]) != ref)
    return miss, wt, extra
