"""GA pipeline flowchart — visual diagram of the genetic algorithm.

Color coding per spec:
  - Blue: initialization
  - Green: evaluation
  - Orange: genetic operators
  - Red: termination
  - Diamond: decision point

Saves to: report/figures/ga_flowchart.png at 300 DPI.
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

# Color scheme
C_INIT = "#4A90D9"       # Blue — initialization
C_EVAL = "#43A047"       # Green — evaluation
C_GENETIC = "#FF9800"    # Orange — genetic operators
C_TERMINATE = "#E53935"  # Red — termination
C_DECISION = "#FDD835"   # Yellow — decision
C_TEXT = "#FFFFFF"
C_DARK_TEXT = "#333333"


def draw_rounded_box(ax, x, y, w, h, text, color, text_color=C_TEXT,
                     fontsize=9, zorder=5):
    """Draw a rounded rectangle process box with text."""
    rect = FancyBboxPatch(
        (x - w / 2, y - h / 2), w, h,
        boxstyle="round,pad=4",
        facecolor=color, edgecolor="black", linewidth=1.2,
        alpha=0.9, zorder=zorder)
    ax.add_patch(rect)
    ax.text(x, y, text, ha="center", va="center",
            fontsize=fontsize, fontweight="bold", color=text_color,
            zorder=zorder + 1, wrap=True)


def draw_diamond(ax, x, y, w, h, text, color=C_DECISION,
                 text_color=C_DARK_TEXT, fontsize=8):
    """Draw a diamond decision box."""
    half_w, half_h = w / 2, h / 2
    diamond = plt.Polygon(
        [(x, y + half_h), (x + half_w, y),
         (x, y - half_h), (x - half_w, y)],
        facecolor=color, edgecolor="black", linewidth=1.2,
        alpha=0.9, zorder=5)
    ax.add_patch(diamond)
    ax.text(x, y, text, ha="center", va="center",
            fontsize=fontsize, fontweight="bold", color=text_color,
            zorder=6)


def draw_arrow(ax, start, end, color="black", lw=1.5):
    """Draw an arrow between two points."""
    ax.annotate("", xy=end, xytext=start,
                arrowprops=dict(arrowstyle="-|>", color=color,
                                lw=lw, mutation_scale=15))


def draw_flowchart():
    """Draw the complete GA pipeline flowchart."""
    fig, ax = plt.subplots(figsize=(10, 14))

    # Layout constants
    cx = 200       # Center x
    box_w = 200
    box_h = 35
    y_step = 55
    y = 610        # Start y (top)

    # --- START ---
    draw_rounded_box(ax, cx, y, 80, 28, "START", C_TERMINATE, fontsize=10)
    y -= y_step * 0.7

    draw_arrow(ax, (cx, y + 30), (cx, y + box_h / 2 + 3))

    # --- Initialize ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Initialize Random Population\n(N individuals in [0,1]^n)",
                     C_INIT, fontsize=8.5)
    y -= y_step

    draw_arrow(ax, (cx, y + box_h + 17), (cx, y + box_h / 2 + 3))

    # --- Evaluate ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Evaluate Fitness\n(Physics Simulation: 10s x 60fps)",
                     C_EVAL, fontsize=8.5)
    y -= y_step

    draw_arrow(ax, (cx, y + box_h + 17), (cx, y + box_h / 2 + 3))

    # --- Record Stats ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Record Statistics\n(best, avg, diversity per gen)",
                     C_EVAL, fontsize=8.5)
    y -= y_step * 0.9

    draw_arrow(ax, (cx, y + box_h + 10), (cx, y + 20))

    # --- Decision diamond ---
    diamond_y = y
    draw_diamond(ax, cx, diamond_y, 130, 50,
                 "Generation\n< G?", fontsize=8.5)

    # NO branch → right → Return Best
    no_x = cx + 130
    draw_arrow(ax, (cx + 65, diamond_y), (no_x - box_w / 4, diamond_y))
    ax.text(cx + 75, diamond_y + 12, "No", fontsize=9, fontweight="bold",
            color=C_TERMINATE)

    draw_rounded_box(ax, no_x + 30, diamond_y, 120, box_h,
                     "Return Best\nSolution x*",
                     C_TERMINATE, fontsize=8.5)

    # END arrow
    end_y = diamond_y - 30
    draw_arrow(ax, (no_x + 30, diamond_y - box_h / 2),
               (no_x + 30, end_y + 14))
    draw_rounded_box(ax, no_x + 30, end_y, 60, 22, "END",
                     C_TERMINATE, fontsize=9)

    # YES branch → down
    y = diamond_y - y_step * 0.9
    draw_arrow(ax, (cx, diamond_y - 25), (cx, y + box_h / 2 + 3))
    ax.text(cx - 20, diamond_y - 35, "Yes", fontsize=9,
            fontweight="bold", color=C_INIT)

    # --- Elitism ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Elitism\n(Copy top E% to next gen)",
                     C_GENETIC, fontsize=8.5)
    y -= y_step

    draw_arrow(ax, (cx, y + box_h + 17), (cx, y + box_h / 2 + 3))

    # --- Selection ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Selection\n(Tournament / Roulette / Rank)",
                     C_GENETIC, fontsize=8.5)
    y -= y_step

    draw_arrow(ax, (cx, y + box_h + 17), (cx, y + box_h / 2 + 3))

    # --- Crossover ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Crossover\n(Single-point / Two-point / Uniform)",
                     C_GENETIC, fontsize=8.5)
    y -= y_step

    draw_arrow(ax, (cx, y + box_h + 17), (cx, y + box_h / 2 + 3))

    # --- Mutation ---
    draw_rounded_box(ax, cx, y, box_w, box_h,
                     "Mutation\n(Fixed / Adaptive Gaussian)",
                     C_GENETIC, fontsize=8.5)
    y -= y_step * 0.8

    draw_arrow(ax, (cx, y + box_h + 10), (cx, y + box_h / 2 + 3))

    # --- Form New Population ---
    form_y = y
    draw_rounded_box(ax, cx, form_y, box_w, box_h,
                     "Form New Population\n(Replace P with P_next)",
                     C_INIT, fontsize=8.5)

    # --- Loop-back arrow ---
    # Go left, then up, then right back to Evaluate
    loop_x = cx - 150
    eval_y = 610 - y_step * 2  # y of "Evaluate Fitness"

    # Down from form box → left
    loop_start_y = form_y - box_h / 2
    ax.plot([cx, cx], [loop_start_y, loop_start_y - 15],
            color="black", linewidth=1.5, zorder=4)
    ax.plot([cx, loop_x], [loop_start_y - 15, loop_start_y - 15],
            color="black", linewidth=1.5, zorder=4)
    ax.plot([loop_x, loop_x], [loop_start_y - 15, eval_y],
            color="black", linewidth=1.5, zorder=4)
    ax.annotate("", xy=(cx - box_w / 2 - 3, eval_y),
                xytext=(loop_x, eval_y),
                arrowprops=dict(arrowstyle="-|>", color="black",
                                lw=1.5, mutation_scale=15))

    # Loop label
    ax.text(loop_x - 8, (loop_start_y - 15 + eval_y) / 2,
            "Next\nGeneration", ha="center", fontsize=8,
            fontweight="bold", color="#666666", rotation=90)

    # --- Legend ---
    legend_items = [
        (C_INIT, "Initialization / Population"),
        (C_EVAL, "Evaluation / Statistics"),
        (C_GENETIC, "Genetic Operators"),
        (C_TERMINATE, "Termination"),
        (C_DECISION, "Decision Point"),
    ]

    leg_x = 330
    leg_y = 170
    ax.text(leg_x, leg_y + 20, "Legend:", fontsize=9, fontweight="bold")
    for i, (color, label) in enumerate(legend_items):
        ly = leg_y - i * 18
        ax.add_patch(plt.Rectangle((leg_x, ly - 5), 14, 10,
                                    facecolor=color, edgecolor="black",
                                    linewidth=0.5))
        ax.text(leg_x + 20, ly, label, va="center", fontsize=7.5)

    # --- Title ---
    ax.set_title("Genetic Algorithm Pipeline",
                 fontsize=16, fontweight="bold", pad=15)

    ax.set_xlim(-10, 440)
    ax.set_ylim(form_y - 50, 640)
    ax.set_aspect("equal")
    ax.axis("off")

    return fig


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[GA Flowchart]")

    fig = draw_flowchart()
    out_path = FIGURES_DIR / "ga_flowchart.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path}")


if __name__ == "__main__":
    main()
