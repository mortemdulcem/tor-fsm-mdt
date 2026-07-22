"""
Reproducible recreation of the framework architecture figure (image1) with
correct labels. Preserves the original composition:
  - orange "Tor Protocol Specification" side with the attack taxonomy arc,
  - concentric translucent FSM CORE,
  - blue "Security Interpretation Layer" with comparative baselines,
  - legend (positive / negative).

Run: python3 experiments/figure_architecture.py
Output: experiments/figure_architecture.png
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Ellipse, FancyArrowPatch

rng = np.random.default_rng(42)

ORANGE = "#E8871E"
ORANGE_L = "#F4A83D"
BLUE = "#3B5B92"
BLUE_L = "#6E8CBE"
GREY = "#4A4A4A"

fig, ax = plt.subplots(figsize=(12.8, 7.2), dpi=200)
ax.set_xlim(0, 16)
ax.set_ylim(0, 9)
ax.axis("off")

core = np.array([7.3, 4.6])

# ---- particle clouds -------------------------------------------------------
# Orange crescent cloud (left, outside the attack arc)
n = 2600
ang = rng.uniform(np.deg2rad(120), np.deg2rad(240), n)
rad = rng.uniform(4.6, 6.6, n) * rng.uniform(0.6, 1.0, n)
px = core[0] + rad * np.cos(ang)
py = core[1] + rad * np.sin(ang)
m = (px > 0) & (py > 0.3) & (py < 8.7)
ax.scatter(px[m], py[m], s=rng.uniform(0.4, 4.0, m.sum()),
           c=ORANGE, alpha=0.30, linewidths=0)

# Blue nebula cloud (right)
n = 2600
cx, cy = 11.7, 3.7
bx = rng.normal(cx, 1.5, n)
by = rng.normal(cy, 1.7, n)
# denser core blobs
bx = np.concatenate([bx, rng.normal(12.4, 0.55, 700), rng.normal(11.0, 0.5, 500)])
by = np.concatenate([by, rng.normal(2.6, 0.55, 700), rng.normal(4.7, 0.5, 500)])
m = (bx > 9.4) & (bx < 15.9) & (by > 0.4) & (by < 8.4)
ax.scatter(bx[m], by[m], s=rng.uniform(0.4, 4.5, m.sum()),
           c=BLUE, alpha=0.30, linewidths=0)

# ---- concentric FSM core ---------------------------------------------------
for r, a in [(2.75, 0.16), (2.15, 0.20), (1.55, 0.26), (0.95, 0.34), (0.5, 0.5)]:
    ax.add_patch(Circle(core, r, facecolor=ORANGE_L, edgecolor="none", alpha=a))
ax.add_patch(Circle(core, 2.75, facecolor="none", edgecolor=BLUE, lw=2.2, alpha=0.9))

# small inner "delta" node
ax.add_patch(Circle(core + [-1.55, 0.05], 0.16, facecolor="#8a8a8a", alpha=0.6))
ax.add_patch(Circle(core + [-1.55, 0.05], 0.30, facecolor="none", edgecolor="#8a8a8a", lw=1, alpha=0.5))

# ---- attack taxonomy arc (7 correct categories, no duplicates) -------------
attacks = ["CIRCUIT_BYPASS", "REPLAY_ATTACK", "GHOST_CIRCUIT", "HANDSHAKE_SKIP",
           "PREMATURE_DATA", "CIRCUIT_HIJACK", "CREATE_FLOOD"]
angles = np.deg2rad(np.linspace(150, 210, len(attacks)))
Rnode = 3.9
for lbl, th in zip(attacks, angles):
    nx, ny = core[0] + Rnode * np.cos(th), core[1] + Rnode * np.sin(th)
    # leader line to core edge
    ex, ey = core[0] + 2.75 * np.cos(th), core[1] + 2.75 * np.sin(th)
    ax.plot([nx, ex], [ny, ey], color=GREY, lw=0.5, alpha=0.35)
    ax.add_patch(Circle((nx, ny), 0.10, facecolor=BLUE, edgecolor="white", lw=0.6, zorder=5))
    rot = np.rad2deg(th) - 180
    ax.text(nx - 0.18 * np.cos(th) + 0.02, ny - 0.18 * np.sin(th), lbl,
            rotation=rot, rotation_mode="anchor", ha="right", va="center",
            fontsize=8.5, color=GREY, family="monospace", zorder=6)

# ---- core labels -----------------------------------------------------------
ax.text(core[0], core[1] + 2.05, "Tor Protocol Specification",
        ha="center", va="center", fontsize=9.5, fontweight="bold", color=GREY)
ax.text(core[0], core[1] + 1.65, "Formal Modeling Layer",
        ha="center", va="center", fontsize=8.5, color=GREY)
ax.text(core[0] - 0.05, core[1] + 0.35, "FSM  \u03b4: S\u00d7E\u2192S",
        ha="center", va="center", fontsize=9, color=GREY)
ax.text(core[0] + 0.15, core[1] - 0.05, "FSM CORE",
        ha="center", va="center", fontsize=12.5, fontweight="bold", color=GREY)
ax.text(core[0] - 1.5, core[1] - 0.55, "25\nvalid",
        ha="center", va="center", fontsize=8.5, color=GREY)
ax.text(core[0] + 1.55, core[1] - 0.55, "105\ninvalid",
        ha="center", va="center", fontsize=8.5, color=GREY)
ax.text(core[0] - 0.9, core[1] - 1.15, "Transition\nMatrix",
        ha="center", va="center", fontsize=8.5, fontweight="bold", color=GREY)
ax.text(core[0] + 0.9, core[1] - 1.15, "Behavior\nPartition",
        ha="center", va="center", fontsize=8.5, fontweight="bold", color=GREY)
ax.text(core[0] + 1.75, core[1] - 1.85, "Model-Driven\nTesting",
        ha="center", va="center", fontsize=8.5, fontweight="bold", color=GREY)

# small MDT nodes below core
ax.add_patch(Circle(core + [0.55, -1.95], 0.13, facecolor=ORANGE, edgecolor="white", lw=0.6))
ax.add_patch(Circle(core + [0.30, -2.35], 0.10, facecolor=ORANGE_L, edgecolor="white", lw=0.5))
ax.add_patch(plt.Rectangle((core[0]+0.55, core[1]-2.55), 0.18, 0.18,
             facecolor=ORANGE, edgecolor="white", lw=0.5, angle=45))

# ---- left titles -----------------------------------------------------------
ax.text(0.3, 8.4, "Tor Protocol\nSpecification", ha="left", va="top",
        fontsize=15, fontweight="bold", color=GREY)
ax.text(0.3, 6.6, "Deterministic\nFSM \u2014 S=10, E=13", ha="left", va="top",
        fontsize=10, color=GREY)
ax.text(0.3, 0.9, "valid paths \u2192\nTesting Pipeline", ha="left", va="top",
        fontsize=10, fontweight="bold", color=ORANGE)
# dashed vertical guide (like original)
ax.plot([0.35, 0.35], [1.4, 6.0], color=ORANGE, lw=1.2, ls=(0, (4, 3)), alpha=0.7)

# ---- right side: interpretation layer text --------------------------------
ax.annotate("", xy=(9.9, 3.9), xytext=(core[0]+2.4, core[1]-1.6),
            arrowprops=dict(arrowstyle="->", color=GREY, lw=0.8, alpha=0.6))
ax.text(9.9, 4.35, "MDT (proposed)\nRandom Testing", ha="left", va="center",
        fontsize=9, fontweight="bold", color=GREY)
ax.text(12.7, 4.25, "GreedySC", ha="center", va="center", fontsize=9, color=GREY)
ax.text(11.3, 3.15, "GreedySC", ha="center", va="center", fontsize=9, color=GREY)
ax.text(13.7, 3.55, "SC \u00b7 TC \u00b7 ITDR \u00b7 FPR", ha="center", va="center",
        fontsize=9.5, fontweight="bold", color=GREY)
ax.text(13.9, 2.75, "Welch's t-test\nMann\u2013Whitney U\nCohen's d",
        ha="center", va="center", fontsize=8.5, color=GREY)
ax.text(15.7, 1.35, "Security\nInterpretation\nLayer", ha="right", va="center",
        fontsize=15, fontweight="bold", color=GREY)

# ---- comparative baselines ellipses ---------------------------------------
for (ex, ey) in [(12.2, 7.2), (8.7, 1.15)]:
    ax.add_patch(Ellipse((ex, ey), 3.0, 1.15, facecolor=BLUE_L, alpha=0.28, edgecolor="none"))
    ax.add_patch(Circle((ex - 1.0, ey), 0.16, facecolor=BLUE, edgecolor="white", lw=0.6))
    ax.text(ex - 0.7, ey + 0.16, "Comparative Baselines", ha="left", va="center",
            fontsize=9, fontweight="bold", color=GREY)
    ax.text(ex - 0.7, ey - 0.18, "identical model, environment, budget",
            ha="left", va="center", fontsize=7.5, color=GREY)

# ---- legend (top-right) ----------------------------------------------------
lx, ly = 14.4, 8.4
ax.add_patch(Circle((lx, ly), 0.15, facecolor=BLUE, edgecolor="white", lw=0.6))
ax.text(lx, ly, "+", ha="center", va="center", color="white", fontsize=10, fontweight="bold")
ax.text(lx + 0.28, ly, "= positive", ha="left", va="center", fontsize=9, color=GREY)
ax.add_patch(Circle((lx, ly - 0.45), 0.15, facecolor=ORANGE, edgecolor="white", lw=0.6))
ax.text(lx, ly - 0.45, "\u2212", ha="center", va="center", color="white", fontsize=10, fontweight="bold")
ax.text(lx + 0.28, ly - 0.45, "= negative", ha="left", va="center", fontsize=9, color=GREY)

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
out = "experiments/figure_architecture.png"
plt.savefig(out, dpi=200, facecolor="white")
print("saved", out)
