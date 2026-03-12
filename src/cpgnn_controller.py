"""CPG + Neural Network hybrid controller (v2 highest tier).

Combines a Kuramoto CPG (open-loop rhythm) with a small feedforward
neural network that modulates CPG output based on sensory feedback.
This creates a closed-loop controller: the CPG provides the base walking
pattern, and the NN adjusts it in response to the creature's actual state.

Gene layout (96 genes, all normalized [0, 1]):
  Genes  0-37:  CPG (same layout as CPGController — 38 genes)
  Genes 38-95:  NN weights (58 genes total)
    38-61:  W1 — input-to-hidden weights  (4 hidden x 6 input = 24)
    62-65:  b1 — hidden biases            (4)
    66-89:  W2 — hidden-to-output weights (6 output x 4 hidden = 24)
    90-95:  b2 — output biases            (6)

NN architecture:  6 → 4 → 6  (tanh activations)
  Input:   6 reduced sensors (hip angles, hip ang.vels, torso angle, foot_L)
  Hidden:  4 neurons (tanh)
  Output:  6 modulation signals (tanh, range [-1, 1])

Modulation formula:
  final_target_i = cpg_target_i * (1 + 0.5 * m_i)
  where m_i is the NN output in [-1, 1].
  When m_i = 0: no modulation (pass-through CPG output).
  When m_i = 1: 50% increase.
  When m_i = -1: 50% decrease.

Weight scaling:  gene * 4 - 2  → [-2, 2]
  When gene = 0.5: weight = 0 (frozen-NN baseline produces zero modulation).
"""

import random

import numpy as np

from src.cpg_controller import CPGController
from src.sensors import get_reduced_sensors


# ---------------------------------------------------------------------------
# NN constants
# ---------------------------------------------------------------------------

N_INPUT = 6    # reduced sensor dimensions
N_HIDDEN = 4   # hidden layer size
N_OUTPUT = 6   # one modulation signal per joint

# Gene counts for NN portion
N_W1 = N_HIDDEN * N_INPUT   # 24 weights
N_B1 = N_HIDDEN             # 4 biases
N_W2 = N_OUTPUT * N_HIDDEN  # 24 weights
N_B2 = N_OUTPUT             # 6 biases
N_NN_GENES = N_W1 + N_B1 + N_W2 + N_B2  # 58 total

N_CPG_GENES = 38
N_TOTAL_GENES = N_CPG_GENES + N_NN_GENES  # 96


# ---------------------------------------------------------------------------
# CPG+NN Controller
# ---------------------------------------------------------------------------

class CPGNNController:
    """CPG + feedforward NN hybrid controller with 96 evolvable genes.

    The CPG provides rhythmic base targets and the NN modulates them
    based on 6 sensory inputs.  This is a multiplicative modulation
    scheme: the NN output scales the CPG output rather than replacing it,
    ensuring the creature always has a walking pattern even if the NN
    outputs zeros.
    """

    def __init__(self, chromosome):
        """Decode 96 genes into CPG parameters and NN weights.

        Args:
            chromosome: array-like of 96 floats in [0, 1].
        """
        assert len(chromosome) >= N_TOTAL_GENES, \
            f"CPG+NN requires {N_TOTAL_GENES} genes, got {len(chromosome)}"

        # --- CPG (first 38 genes) ---
        self.cpg = CPGController(chromosome[:N_CPG_GENES])

        # --- NN weights (genes 38-95) ---
        nn_genes = np.array(chromosome[N_CPG_GENES:N_TOTAL_GENES],
                            dtype=np.float64)

        # Scale from [0, 1] to [-2, 2]
        nn_scaled = nn_genes * 4.0 - 2.0

        # Unpack weights in order: W1, b1, W2, b2
        idx = 0

        # W1: shape (N_HIDDEN, N_INPUT) = (4, 6)
        self.W1 = nn_scaled[idx:idx + N_W1].reshape(N_HIDDEN, N_INPUT)
        idx += N_W1

        # b1: shape (N_HIDDEN,) = (4,)
        self.b1 = nn_scaled[idx:idx + N_B1]
        idx += N_B1

        # W2: shape (N_OUTPUT, N_HIDDEN) = (6, 4)
        self.W2 = nn_scaled[idx:idx + N_W2].reshape(N_OUTPUT, N_HIDDEN)
        idx += N_W2

        # b2: shape (N_OUTPUT,) = (6,)
        self.b2 = nn_scaled[idx:idx + N_B2]
        idx += N_B2

    def forward_nn(self, sensors_6):
        """Run the feedforward NN on 6 reduced sensor inputs.

        Architecture: 6 → 4 (tanh) → 6 (tanh)

        Args:
            sensors_6: np.ndarray of shape (6,), the reduced sensor vector.

        Returns:
            np.ndarray of shape (6,) — modulation signals in [-1, 1].
        """
        # Hidden layer
        hidden = np.tanh(self.W1 @ sensors_6 + self.b1)

        # Output layer
        modulation = np.tanh(self.W2 @ hidden + self.b2)

        return modulation

    def get_targets(self, t, dt, sensors):
        """Compute modulated CPG targets from sensor feedback.

        Steps:
          1. Advance CPG phases → get base target angles
          2. Extract reduced sensors (6 dims)
          3. Run NN → get modulation signals
          4. Apply multiplicative modulation

        Args:
            t: current simulation time (passed through to CPG).
            dt: timestep in seconds.
            sensors: np.ndarray of shape (18,) — full sensor vector.

        Returns:
            tuple of:
              - list of 6 floats: final target joint angles
              - np.ndarray of shape (6,): modulation values (for logging)
        """
        # 1. CPG base targets
        cpg_targets = self.cpg.step(dt)

        # 2. Reduced sensors
        reduced = get_reduced_sensors(sensors)

        # 3. NN modulation
        modulation = self.forward_nn(reduced)

        # 4. Multiplicative modulation: final = cpg * (1 + 0.5 * m)
        #    Range of multiplier: [0.5, 1.5] when m in [-1, 1]
        final_targets = [
            cpg_targets[i] * (1.0 + 0.5 * modulation[i])
            for i in range(6)
        ]

        return final_targets, modulation


# ---------------------------------------------------------------------------
# Population seeding (cascade: CPG -> CPG+NN)
# ---------------------------------------------------------------------------

def initialize_cpgnn_population(pop_size, best_cpg_chromosomes):
    """Create a CPG+NN population seeded from the best CPG creatures.

    Seeds ALL individuals — same rationale as CPG seeding (Risk 1).
    The CPG genes carry the walking pattern; NN genes start at 0.5
    which maps to weight=0 via (0.5*4-2=0), producing zero modulation
    (identity pass-through: final = cpg * (1 + 0.5*0) = cpg * 1.0).

    Args:
        pop_size: number of individuals.
        best_cpg_chromosomes: list of np.ndarray (each shape (38,)),
            the top-performing CPG chromosomes.

    Returns:
        list of np.ndarray — pop_size chromosomes, each shape (96,).
    """
    assert len(best_cpg_chromosomes) > 0, \
        "Need at least one CPG chromosome to seed from"

    population = []
    for _ in range(pop_size):
        # Pick a random template
        template = random.choice(best_cpg_chromosomes)
        assert len(template) >= N_CPG_GENES, \
            f"CPG chromosome should be {N_CPG_GENES} genes, got {len(template)}"

        chromo = np.zeros(N_TOTAL_GENES, dtype=np.float64)

        # Copy CPG genes with +/-3% noise
        for j in range(N_CPG_GENES):
            noisy = template[j] + np.random.normal(0, 0.03)
            chromo[j] = np.clip(noisy, 0.0, 1.0)

        # Set NN genes to 0.5 (zero weights/biases → no modulation)
        chromo[N_CPG_GENES:N_TOTAL_GENES] = 0.5

        population.append(chromo)

    return population


# ---------------------------------------------------------------------------
# Frozen-NN experiment helper
# ---------------------------------------------------------------------------

def evaluate_frozen_nn(chromosome):
    """Return a copy of the chromosome with NN weights frozen at 0.5.

    When NN genes = 0.5, all weights and biases scale to 0 via (0.5*4-2=0).
    tanh(0) = 0 for all hidden and output neurons, so modulation = [0,...,0].
    Final targets = cpg * (1 + 0.5*0) = cpg * 1.0 (identical to pure CPG).

    This is used for the "frozen-NN" control experiment, which isolates
    the effect of the larger chromosome (96 vs 38 genes) from actual
    sensory feedback utilization.  If frozen-NN performs the same as CPG,
    the larger search space doesn't help.  If CPG+NN beats frozen-NN,
    the NN is genuinely utilizing sensor information.

    Args:
        chromosome: np.ndarray of shape (96,).

    Returns:
        np.ndarray of shape (96,) — copy with genes 38:96 set to 0.5.
    """
    frozen = np.array(chromosome, dtype=np.float64).copy()
    frozen[N_CPG_GENES:N_TOTAL_GENES] = 0.5
    return frozen
