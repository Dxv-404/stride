"""Encoding diagram — Direct vs Indirect chromosome encoding comparison.

Shows side-by-side comparison:
- Direct: full 18-gene chromosome with color-coded gene-to-joint mapping
- Indirect: 9-gene chromosome with arrows showing L/R mirroring

Saves to: report/figures/encoding_diagram.png at 300 DPI.
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

# Gene group colors
COLORS = {
    "hip_L":     "#4A90D9",
    "hip_R":     "#7CB9E8",
    "knee_L":    "#66BB6A",
    "knee_R":    "#A5D6A7",
    "shldr_L":   "#FF9800",
    "shldr_R":   "#FFB74D",
    "hip":       "#4A90D9",
    "knee":      "#66BB6A",
    "shoulder":  "#FF9800",
}


def draw_gene_box(ax, x, y, w, h, label, color, fontsize=7):
    """Draw a single gene box with label."""
    rect = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=1",
        facecolor=color, edgecolor="black", linewidth=0.8, alpha=0.85)
    ax.add_patch(rect)
    ax.text(x + w / 2, y + h / 2, label,
            ha="center", va="center", fontsize=fontsize,
            fontweight="bold", color="white")


def draw_encoding_diagram():
    """Draw complete encoding comparison diagram on a single figure."""
    fig, ax = plt.subplots(figsize=(14, 8.5))

    # =========================================================================
    # DIRECT ENCODING (top half)
    # =========================================================================
    box_w = 28
    box_h = 18
    gap = 2
    group_gap = 6
    origin_x = 15
    origin_y = 200

    direct_genes = [
        (0, "A", "hip_L"), (1, "f", "hip_L"), (2, "phi", "hip_L"),
        (3, "A", "hip_R"), (4, "f", "hip_R"), (5, "phi", "hip_R"),
        (6, "A", "knee_L"), (7, "f", "knee_L"), (8, "phi", "knee_L"),
        (9, "A", "knee_R"), (10, "f", "knee_R"), (11, "phi", "knee_R"),
        (12, "A", "shldr_L"), (13, "f", "shldr_L"), (14, "phi", "shldr_L"),
        (15, "A", "shldr_R"), (16, "f", "shldr_R"), (17, "phi", "shldr_R"),
    ]

    # Section title
    ax.text(origin_x, origin_y + 48,
            "Direct Encoding (18 genes)",
            fontsize=13, fontweight="bold")
    ax.text(origin_x, origin_y + 35,
            "Each gene directly maps to one joint parameter",
            fontsize=9, style="italic", color="#666666")

    # Draw genes
    x_pos = origin_x
    group_labels = ["hip_L", "hip_R", "knee_L", "knee_R", "shldr_L", "shldr_R"]
    group_idx = 0
    group_starts = []

    for i, (idx, label, color_key) in enumerate(direct_genes):
        if i % 3 == 0:
            group_starts.append(x_pos)

        draw_gene_box(ax, x_pos, origin_y, box_w, box_h,
                      label, COLORS[color_key], fontsize=7)

        # Gene index below
        ax.text(x_pos + box_w / 2, origin_y - 7, str(idx),
                ha="center", fontsize=5.5, color="#999999")

        x_pos += box_w + gap

        # Group separator after every 3rd gene
        if (i + 1) % 3 == 0:
            # Group label above
            gx = group_starts[-1] + 1.5 * (box_w + gap) - gap / 2
            ax.text(gx, origin_y + box_h + 6,
                    group_labels[group_idx],
                    ha="center", fontsize=7, fontweight="bold",
                    color=COLORS[group_labels[group_idx]])
            group_idx += 1

            if i < len(direct_genes) - 1:
                # Gap between groups, bigger between L/R pairs
                x_pos += group_gap if group_idx % 2 == 0 else gap

    # Parameter ranges
    ax.text(origin_x, origin_y - 20,
            "A: amplitude [0, pi/2]     f: frequency [0.5, 5.0 Hz]     "
            "phi: phase [0, 2*pi]",
            fontsize=7.5, color="#666666")

    # =========================================================================
    # INDIRECT ENCODING (bottom half)
    # =========================================================================
    ind_box_w = 42
    ind_box_h = 22
    ind_gap = 3
    ind_group_gap = 12
    ind_origin_x = 60
    ind_origin_y = 100

    indirect_genes = [
        (0, "A", "hip"), (1, "f", "hip"), (2, "phi", "hip"),
        (3, "A", "knee"), (4, "f", "knee"), (5, "phi", "knee"),
        (6, "A", "shoulder"), (7, "f", "shoulder"), (8, "phi", "shoulder"),
    ]

    # Section title
    ax.text(ind_origin_x, ind_origin_y + 55,
            "Indirect Encoding (9 genes)",
            fontsize=13, fontweight="bold")
    ax.text(ind_origin_x, ind_origin_y + 42,
            "Bilateral symmetry: Left side mirrored to Right with pi phase offset",
            fontsize=9, style="italic", color="#666666")

    # Draw genes
    x_pos = ind_origin_x
    ind_group_labels = ["hip", "knee", "shoulder"]
    ind_group_idx = 0
    ind_group_starts = []

    for i, (idx, label, color_key) in enumerate(indirect_genes):
        if i % 3 == 0:
            ind_group_starts.append(x_pos)

        draw_gene_box(ax, x_pos, ind_origin_y, ind_box_w, ind_box_h,
                      label, COLORS[color_key], fontsize=8)

        ax.text(x_pos + ind_box_w / 2, ind_origin_y - 9, str(idx),
                ha="center", fontsize=6, color="#999999")

        x_pos += ind_box_w + ind_gap

        if (i + 1) % 3 == 0:
            gx = ind_group_starts[-1] + 1.5 * (ind_box_w + ind_gap) - ind_gap / 2
            ax.text(gx, ind_origin_y + ind_box_h + 8,
                    ind_group_labels[ind_group_idx],
                    ha="center", fontsize=8.5, fontweight="bold",
                    color=COLORS[ind_group_labels[ind_group_idx]])
            ind_group_idx += 1

            if i < len(indirect_genes) - 1:
                x_pos += ind_group_gap

    # Total width of indirect encoding
    ind_total_end = x_pos
    ind_center_x = (ind_origin_x + ind_total_end) / 2

    # Mirror arrow
    mirror_y = ind_origin_y - 35
    ax.text(ind_center_x, ind_origin_y - 18,
            "Mirror with phase offset",
            ha="center", fontsize=9, fontweight="bold", color="#E53935")

    ax.annotate("", xy=(ind_center_x, mirror_y + 10),
                xytext=(ind_center_x, ind_origin_y - 7),
                arrowprops=dict(arrowstyle="-|>", color="#E53935",
                                lw=2.0, ls="--"))

    # Output boxes: Left and Right
    out_box_w = 100
    out_box_h = 20

    for side, offset, note in [("Left Side", -70, "Same params"),
                                ("Right Side", 70,
                                 "phi_R = (phi_L + pi) mod 2pi")]:
        bx = ind_center_x + offset - out_box_w / 2
        by = mirror_y - 5
        rect = patches.FancyBboxPatch(
            (bx, by), out_box_w, out_box_h,
            boxstyle="round,pad=2",
            facecolor="#EEEEEE", edgecolor="#666666", linewidth=1.0)
        ax.add_patch(rect)
        ax.text(bx + out_box_w / 2, by + out_box_h / 2,
                side, ha="center", va="center", fontsize=8.5,
                fontweight="bold")
        ax.text(bx + out_box_w / 2, by - 9,
                note, ha="center", fontsize=6.5, color="#888888",
                style="italic")

    # Advantage/disadvantage note
    ax.text(ind_center_x, mirror_y - 35,
            "Advantage: Enforces biological symmetry, halves search space   |   "
            "Disadvantage: Cannot discover asymmetric gaits",
            ha="center", fontsize=7.5, color="#555555",
            bbox=dict(boxstyle="round,pad=0.4", fc="#FFF9C4",
                      ec="#FBC02D", alpha=0.85))

    # =========================================================================
    # Divider line between sections
    # =========================================================================
    ax.plot([5, 560], [160, 160], color="#CCCCCC", linewidth=1.0,
            linestyle="--", zorder=1)

    # =========================================================================
    # Title
    # =========================================================================
    ax.set_title("Direct vs Indirect Chromosome Encoding",
                 fontsize=16, fontweight="bold", pad=12)

    ax.set_xlim(-5, 570)
    ax.set_ylim(15, 260)
    ax.axis("off")

    return fig


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Encoding Diagram]")

    fig = draw_encoding_diagram()
    out_path = FIGURES_DIR / "encoding_diagram.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path}")


if __name__ == "__main__":
    main()
