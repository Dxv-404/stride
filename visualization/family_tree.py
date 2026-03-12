"""Family tree — lineage/genealogy of the best evolved individual.

Traces the ancestry of the final best creature back through generations,
showing how the best solution was constructed via crossover and selection.
Nodes are colored by fitness; the highlighted path shows the direct
lineage to the champion individual.

Saves to: report/figures/family_tree.png at 300 DPI.
"""

import pickle
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"


def build_ancestry(parent_log, final_best_idx, pop_size, n_gens):
    """Trace the ancestry of the best individual backwards through gens.

    Args:
        parent_log: list of (gen, child_idx, parent1_idx, parent2_idx).
        final_best_idx: index of the best individual in final population.
        pop_size: population size per generation.
        n_gens: total number of generations.

    Returns:
        ancestors: set of (gen, individual_idx) in the lineage.
        edges: list of ((gen_parent, idx_parent), (gen_child, idx_child)).
    """
    # Build lookup: (gen, child_idx) -> (parent1_idx, parent2_idx)
    lookup = {}
    for gen, child_idx, p1, p2 in parent_log:
        lookup[(gen, child_idx)] = (p1, p2)

    # BFS backwards from the final best
    ancestors = set()
    edges = []
    frontier = {(n_gens - 1, final_best_idx)}
    ancestors.add((n_gens - 1, final_best_idx))

    for gen in range(n_gens - 1, -1, -1):
        next_frontier = set()
        for g, idx in frontier:
            if g != gen:
                continue
            key = (gen, idx)
            if key in lookup:
                p1, p2 = lookup[key]
                parent_gen = gen - 1 if gen > 0 else 0

                # Parent 1
                node_p1 = (parent_gen, p1)
                if parent_gen >= 0:
                    ancestors.add(node_p1)
                    edges.append((node_p1, (gen, idx)))
                    if parent_gen > 0:
                        next_frontier.add(node_p1)

                # Parent 2 (may be same as p1 for elitism/tournament)
                if p2 != p1:
                    node_p2 = (parent_gen, p2)
                    ancestors.add(node_p2)
                    edges.append((node_p2, (gen, idx)))
                    if parent_gen > 0:
                        next_frontier.add(node_p2)

        frontier = next_frontier

    return ancestors, edges


def get_node_fitness(gen, idx, convergence_history, avg_fitness_per_gen):
    """Estimate fitness for a node. Use generation-level stats as proxy."""
    if gen < len(convergence_history):
        # Interpolate: assume best at gen gets best_fitness,
        # others get avg_fitness. Use a blend based on index diversity.
        best = convergence_history[gen]
        avg = avg_fitness_per_gen[gen] if gen < len(avg_fitness_per_gen) else best
        return avg  # conservative: color by generation average
    return 0


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Family Tree]")

    pkl_path = RESULTS_DIR / "baseline.pkl"
    if not pkl_path.exists():
        print("  ERROR: baseline.pkl not found")
        return

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    # Use best run
    best_run_idx = max(range(len(runs)), key=lambda i: runs[i]["best_fitness"])
    run = runs[best_run_idx]

    parent_log = run.get("parent_log", [])
    if not parent_log:
        print("  ERROR: No parent_log data in run")
        return

    convergence = run.get("convergence_history",
                          run.get("best_fitness_per_gen", []))
    avg_fitness = run.get("avg_fitness_per_gen", convergence)
    final_fitnesses = run.get("final_fitnesses", [])
    pop_size = 100
    n_gens = len(convergence)

    # Find best individual in final population
    if final_fitnesses:
        final_best_idx = int(np.argmax(final_fitnesses))
    else:
        final_best_idx = 0

    best_fitness = float(run["best_fitness"])
    print(f"  Best run #{best_run_idx}: fitness={best_fitness:.1f}")
    print(f"  Final best individual: index {final_best_idx}")
    print(f"  Parent log entries: {len(parent_log)}")
    print(f"  Tracing ancestry...")

    ancestors, edges = build_ancestry(
        parent_log, final_best_idx, pop_size, n_gens)

    print(f"  Ancestors found: {len(ancestors)}")
    print(f"  Edges: {len(edges)}")

    if len(ancestors) < 2:
        print("  WARNING: Very few ancestors found, creating simplified tree")

    # --- Visualization ---
    # Layout: x = individual index, y = generation (0 at top, n_gens at bottom)
    # To avoid overlapping, we spread nodes horizontally within each gen.

    # Count nodes per generation
    gen_nodes = defaultdict(list)
    for gen, idx in ancestors:
        gen_nodes[gen].append(idx)

    # Assign x positions: spread evenly within each generation
    node_pos = {}
    max_width = max(len(v) for v in gen_nodes.values()) if gen_nodes else 1

    for gen, indices in gen_nodes.items():
        indices_sorted = sorted(indices)
        n = len(indices_sorted)
        for rank, idx in enumerate(indices_sorted):
            if n == 1:
                x = 0.5
            else:
                x = rank / (n - 1)
            node_pos[(gen, idx)] = (x * max_width, gen)

    # Fitness range for coloring
    fit_values = []
    for gen in range(n_gens):
        if gen < len(avg_fitness):
            fit_values.append(avg_fitness[gen])
    if fit_values:
        fit_min, fit_max = min(fit_values), max(fit_values)
    else:
        fit_min, fit_max = 0, 1

    # Normalize fitness for coloring
    cmap = plt.cm.RdYlGn  # red=low fitness, green=high fitness
    norm = mcolors.Normalize(vmin=fit_min, vmax=fit_max)

    # Figure
    fig_height = max(8, n_gens * 0.15)
    fig, ax = plt.subplots(figsize=(10, fig_height))

    # Draw edges (thin gray lines)
    for (pg, pi), (cg, ci) in edges:
        if (pg, pi) in node_pos and (cg, ci) in node_pos:
            px, py = node_pos[(pg, pi)]
            cx, cy = node_pos[(cg, ci)]
            ax.plot([px, cx], [py, cy], color="#CCCCCC",
                    linewidth=0.3, alpha=0.5, zorder=1)

    # Highlight the direct lineage path (trace only parent1)
    # Build a direct path from gen 0 to final best
    direct_path = set()
    direct_path.add((n_gens - 1, final_best_idx))
    lookup = {}
    for gen, child_idx, p1, p2 in parent_log:
        lookup[(gen, child_idx)] = (p1, p2)

    current = (n_gens - 1, final_best_idx)
    while current[0] > 0:
        gen, idx = current
        if (gen, idx) in lookup:
            p1, _ = lookup[(gen, idx)]
            parent_node = (gen - 1, p1)
            direct_path.add(parent_node)
            # Draw highlighted edge
            if parent_node in node_pos and current in node_pos:
                px, py = node_pos[parent_node]
                cx, cy = node_pos[current]
                ax.plot([px, cx], [py, cy], color="#E53935",
                        linewidth=1.5, alpha=0.8, zorder=3)
            current = parent_node
        else:
            break

    # Draw nodes
    for (gen, idx), (x, y) in node_pos.items():
        fit = get_node_fitness(gen, idx, convergence, avg_fitness)
        color = cmap(norm(fit))
        size = 15 if (gen, idx) in direct_path else 8
        edge_c = "#E53935" if (gen, idx) in direct_path else "none"
        edge_w = 0.8 if (gen, idx) in direct_path else 0
        zorder = 5 if (gen, idx) in direct_path else 2

        ax.scatter(x, y, s=size, color=color, edgecolors=edge_c,
                   linewidths=edge_w, zorder=zorder)

    # Mark the champion
    champ = (n_gens - 1, final_best_idx)
    if champ in node_pos:
        cx, cy = node_pos[champ]
        ax.scatter(cx, cy, s=80, color="#FFD700", edgecolors="#E53935",
                   linewidths=2, zorder=10, marker="*")
        ax.annotate(f"Champion\nFitness: {best_fitness:.0f}",
                    xy=(cx, cy), xytext=(cx + max_width * 0.15, cy + 3),
                    fontsize=8, fontweight="bold", color="#E53935",
                    arrowprops=dict(arrowstyle="->", color="#E53935", lw=1),
                    bbox=dict(boxstyle="round,pad=0.3", fc="white",
                              ec="#E53935", alpha=0.9),
                    zorder=11)

    # Colorbar
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, shrink=0.6, aspect=30, pad=0.02)
    cbar.set_label("Generation Avg Fitness", fontsize=9)
    cbar.ax.tick_params(labelsize=7)

    # Axes
    ax.set_ylabel("Generation", fontsize=10)
    ax.set_xlabel("Individual (spread for visibility)", fontsize=10)
    ax.invert_yaxis()  # gen 0 at top
    ax.set_title("Family Tree — Ancestry of the Best Evolved Creature",
                 fontsize=13, fontweight="bold")

    # Generation markers on y-axis
    gen_ticks = list(range(0, n_gens, max(1, n_gens // 10)))
    if n_gens - 1 not in gen_ticks:
        gen_ticks.append(n_gens - 1)
    ax.set_yticks(gen_ticks)
    ax.set_yticklabels([str(g + 1) for g in gen_ticks], fontsize=7)
    ax.set_xticks([])

    # Legend
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], color="#E53935", linewidth=2,
               label="Direct lineage"),
        Line2D([0], [0], color="#CCCCCC", linewidth=1,
               label="Crossover ancestry"),
        Line2D([0], [0], marker="*", color="#FFD700", markersize=12,
               markeredgecolor="#E53935", markeredgewidth=1.5,
               linestyle="None", label="Champion"),
    ]
    ax.legend(handles=legend_elements, loc="upper left", fontsize=8,
              framealpha=0.9)

    fig.tight_layout()
    out_path = FIGURES_DIR / "family_tree.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


if __name__ == "__main__":
    main()
