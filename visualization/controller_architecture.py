"""Figure 12: Controller Architecture Diagram.

3-panel diagram showing the signal flow for each controller type:
- Sine: genes → sin(2πft + φ) → motor targets → PD controller
- CPG: genes → Kuramoto oscillators (with coupling) → motor targets → PD
- CPG+NN: genes → CPG + (sensors → NN → modulation) → final targets → PD

Uses matplotlib patches/arrows, not images.
Color-code: oscillators=blue, coupling=green, NN=amber, sensors=red.

Saves to: report/figures/controller_architecture.png
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

# Color scheme
C_GENE = "#8E24AA"      # purple — genes
C_OSC = "#1565C0"        # blue — oscillators
C_COUPLE = "#43A047"     # green — coupling
C_NN = "#FF9800"         # amber — neural network
C_SENSOR = "#E53935"     # red — sensors
C_PD = "#546E7A"         # slate — PD controller
C_MOTOR = "#37474F"      # dark slate — motor targets
C_BG = "#FAFAFA"         # light background


def draw_box(ax, x, y, w, h, label, color, fontsize=9, alpha=0.85):
    """Draw a rounded rectangle with centered text."""
    box = FancyBboxPatch((x - w/2, y - h/2), w, h,
                         boxstyle="round,pad=0.1",
                         facecolor=color, edgecolor="black",
                         linewidth=1.2, alpha=alpha)
    ax.add_patch(box)
    ax.text(x, y, label, ha="center", va="center", fontsize=fontsize,
            fontweight="bold", color="white" if color != C_BG else "black",
            wrap=True)
    return box


def draw_arrow(ax, x1, y1, x2, y2, color="black", style="-|>"):
    """Draw an arrow from (x1,y1) to (x2,y2)."""
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color,
                                lw=1.5, connectionstyle="arc3,rad=0"))


def draw_sine_panel(ax):
    """Draw Sine controller architecture."""
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4)
    ax.set_title("(a) Sine Controller", fontsize=12, fontweight="bold",
                 pad=10)

    # Genes
    draw_box(ax, 1.5, 2, 2.2, 1.2, "18 Genes\n[0, 1]", C_GENE, fontsize=8)

    # Sine function
    draw_box(ax, 4.5, 2, 2.2, 1.2, "sin(2πft + φ)\n× amplitude", C_OSC,
             fontsize=8)

    # Motor targets
    draw_box(ax, 7.5, 2, 2.0, 1.2, "6 Motor\nTargets", C_MOTOR, fontsize=8)

    # PD
    draw_box(ax, 7.5, 0.5, 2.0, 0.7, "PD Controller", C_PD, fontsize=8)

    # Arrows
    draw_arrow(ax, 2.6, 2, 3.4, 2)
    draw_arrow(ax, 5.6, 2, 6.5, 2)
    draw_arrow(ax, 7.5, 1.4, 7.5, 0.85)

    # Labels on arrows
    ax.text(3.0, 2.25, "decode", fontsize=7, ha="center", color="#666")
    ax.text(6.0, 2.25, "evaluate", fontsize=7, ha="center", color="#666")

    ax.set_aspect("equal")
    ax.axis("off")


def draw_cpg_panel(ax):
    """Draw CPG controller architecture."""
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4)
    ax.set_title("(b) CPG Controller", fontsize=12, fontweight="bold",
                 pad=10)

    # Genes
    draw_box(ax, 1.2, 2, 1.8, 1.2, "38 Genes\n[0, 1]", C_GENE, fontsize=8)

    # Oscillators
    draw_box(ax, 3.8, 2.8, 2.4, 0.8, "6 Kuramoto\nOscillators", C_OSC,
             fontsize=8)

    # Coupling
    draw_box(ax, 3.8, 1.2, 2.4, 0.8, "10 Directed\nCouplings", C_COUPLE,
             fontsize=8)

    # Motor targets
    draw_box(ax, 7.2, 2, 2.0, 1.2, "6 Motor\nTargets", C_MOTOR, fontsize=8)

    # PD
    draw_box(ax, 7.2, 0.5, 2.0, 0.7, "PD Controller", C_PD, fontsize=8)

    # Arrows
    draw_arrow(ax, 2.1, 2.4, 2.6, 2.8)  # genes → oscillators
    draw_arrow(ax, 2.1, 1.6, 2.6, 1.2)  # genes → coupling
    draw_arrow(ax, 5.0, 2.8, 6.2, 2.3)  # oscillators → targets
    draw_arrow(ax, 5.0, 1.2, 5.0, 2.4, C_COUPLE)  # coupling → oscillators
    draw_arrow(ax, 7.2, 1.4, 7.2, 0.85)

    # Coupling feedback arrow (curved)
    ax.annotate("", xy=(3.8, 2.4), xytext=(3.8, 1.6),
                arrowprops=dict(arrowstyle="-|>", color=C_COUPLE,
                                lw=1.5, connectionstyle="arc3,rad=-0.3"))

    ax.set_aspect("equal")
    ax.axis("off")


def draw_cpgnn_panel(ax):
    """Draw CPG+NN controller architecture."""
    ax.set_xlim(0, 12)
    ax.set_ylim(-0.5, 5)
    ax.set_title("(c) CPG+NN Controller", fontsize=12, fontweight="bold",
                 pad=10)

    # Genes
    draw_box(ax, 1.2, 2.5, 1.8, 1.2, "96 Genes\n[0, 1]", C_GENE, fontsize=8)

    # CPG block
    draw_box(ax, 4.0, 3.5, 2.2, 0.8, "CPG\n(38 genes)", C_OSC, fontsize=8)

    # NN block
    draw_box(ax, 4.0, 1.5, 2.2, 0.8, "NN\n(58 weights)", C_NN, fontsize=8)

    # Sensors
    draw_box(ax, 1.2, 0.5, 1.8, 0.8, "6 Sensors\n(proprioception)", C_SENSOR,
             fontsize=7)

    # Multiply node
    ax.plot(7.0, 2.5, "o", markersize=15, color="white",
            markeredgecolor="black", markeredgewidth=2)
    ax.text(7.0, 2.5, "×", ha="center", va="center", fontsize=14,
            fontweight="bold")

    # Final targets
    draw_box(ax, 9.2, 2.5, 2.0, 1.2, "6 Final\nTargets", C_MOTOR,
             fontsize=8)

    # PD
    draw_box(ax, 9.2, 0.5, 2.0, 0.7, "PD Controller", C_PD, fontsize=8)

    # Arrows
    draw_arrow(ax, 2.1, 3.0, 2.9, 3.5)   # genes → CPG
    draw_arrow(ax, 2.1, 2.0, 2.9, 1.5)   # genes → NN
    draw_arrow(ax, 5.1, 3.5, 6.6, 2.7)   # CPG → multiply
    draw_arrow(ax, 5.1, 1.5, 6.6, 2.3)   # NN → multiply
    draw_arrow(ax, 7.4, 2.5, 8.2, 2.5)   # multiply → targets
    draw_arrow(ax, 2.1, 0.5, 2.9, 1.2)   # sensors → NN
    draw_arrow(ax, 9.2, 1.9, 9.2, 0.85)  # targets → PD

    # Modulation label
    ax.text(6.0, 1.0, "modulation\n(1 + 0.5m)", fontsize=7,
            ha="center", color=C_NN, style="italic")

    # Feedback arrow from body to sensors
    ax.annotate("", xy=(1.2, 0.1), xytext=(9.2, 0.1),
                arrowprops=dict(arrowstyle="-|>", color=C_SENSOR,
                                lw=1.2, linestyle="dashed",
                                connectionstyle="arc3,rad=0.2"))
    ax.text(5.2, -0.2, "body state feedback", fontsize=7,
            ha="center", color=C_SENSOR, style="italic")

    ax.set_aspect("equal")
    ax.axis("off")


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    fig, axes = plt.subplots(1, 3, figsize=(18, 5))

    draw_sine_panel(axes[0])
    draw_cpg_panel(axes[1])
    draw_cpgnn_panel(axes[2])

    fig.suptitle("Controller Architectures", fontsize=15, fontweight="bold",
                 y=1.02)

    # Legend
    legend_handles = [
        mpatches.Patch(color=C_GENE, label="Genes"),
        mpatches.Patch(color=C_OSC, label="Oscillators"),
        mpatches.Patch(color=C_COUPLE, label="Coupling"),
        mpatches.Patch(color=C_NN, label="Neural Network"),
        mpatches.Patch(color=C_SENSOR, label="Sensors"),
        mpatches.Patch(color=C_PD, label="PD Controller"),
    ]
    fig.legend(handles=legend_handles, loc="lower center", ncol=6,
               fontsize=9, bbox_to_anchor=(0.5, -0.05))

    fig.tight_layout()
    out_path = FIGURES_DIR / "controller_architecture.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
