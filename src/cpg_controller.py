"""Kuramoto-coupled Central Pattern Generator (CPG) controller.

V2 intermediate-complexity controller between open-loop sine and
closed-loop CPG+NN.  Uses Kuramoto-style phase coupling between
6 oscillators to produce coordinated joint target angles.

Gene layout (38 genes, all normalized [0, 1]):
  Genes  0-17:  6 oscillators x 3 params (amplitude, frequency, phase)
  Genes 18-37: 10 directed coupling connections x 2 params (weight, phase_offset)

Phase dynamics (Kuramoto):
  dphi_i/dt = 2*pi*f_i + sum_j( w_ij * sin(phi_j - phi_i + Phi_ij) )

Output:
  target_i = amp_i * sin(phi_i)
"""

import math
import random

import numpy as np


# ---------------------------------------------------------------------------
# Coupling topology
# ---------------------------------------------------------------------------

# 10 directed connections between the 6 oscillators.
# Each tuple (from_osc, to_osc) means: oscillator `from_osc` influences
# the phase dynamics of oscillator `to_osc`.
#
# Joint order: hip_L=0, hip_R=1, knee_L=2, knee_R=3, shoulder_L=4, shoulder_R=5
CONNECTIONS = [
    (0, 2), (2, 0),  # hip_L <-> knee_L  (ipsilateral leg coupling)
    (1, 3), (3, 1),  # hip_R <-> knee_R  (ipsilateral leg coupling)
    (0, 1), (1, 0),  # hip_L <-> hip_R   (contralateral hip coupling)
    (2, 3), (3, 2),  # knee_L <-> knee_R (contralateral knee coupling)
    (4, 5), (5, 4),  # shoulder_L <-> shoulder_R (arm coupling)
]

# Maximum phase rate to prevent numerical explosion.
# 10 full revolutions per second = 10 * 2*pi ≈ 62.8 rad/s
MAX_DPHI = 10.0 * 2.0 * math.pi


# ---------------------------------------------------------------------------
# CPG Controller
# ---------------------------------------------------------------------------

class CPGController:
    """Kuramoto-coupled CPG with 38 evolvable genes.

    Each of the 6 oscillators has an amplitude, natural frequency, and
    initial phase.  The 10 directed coupling connections synchronize
    oscillator phases via Kuramoto dynamics.

    The controller is stateful: each call to step() advances the
    internal phases by dt.
    """

    def __init__(self, chromosome):
        """Decode 38 genes into oscillator parameters and coupling weights.

        Args:
            chromosome: array-like of 38 floats in [0, 1].
        """
        assert len(chromosome) >= 38, \
            f"CPG requires 38 genes, got {len(chromosome)}"

        # --- Decode 6 oscillators (genes 0-17) ---
        self.amplitudes = []
        self.frequencies = []
        self.phases = []  # mutable — updated each step

        for i in range(6):
            base = i * 3
            amp = chromosome[base] * (math.pi / 2)       # [0, pi/2] rad
            freq = chromosome[base + 1] * 4.5 + 0.5      # [0.5, 5.0] Hz
            phase = chromosome[base + 2] * (2 * math.pi)  # [0, 2*pi] rad
            self.amplitudes.append(amp)
            self.frequencies.append(freq)
            self.phases.append(phase)

        # --- Decode 10 coupling connections (genes 18-37) ---
        # Each connection has 2 genes: weight and phase offset.
        # connections_to[i] = list of (from_osc, weight, phase_offset)
        # for all connections arriving at oscillator i.
        self.connections_to = [[] for _ in range(6)]

        for c_idx, (from_osc, to_osc) in enumerate(CONNECTIONS):
            gene_base = 18 + c_idx * 2
            weight = (chromosome[gene_base] - 0.5) * 4.0      # [-2, 2]
            phase_offset = chromosome[gene_base + 1] * (2 * math.pi)  # [0, 2*pi]
            self.connections_to[to_osc].append(
                (from_osc, weight, phase_offset)
            )

    def step(self, dt):
        """Advance oscillator phases by one timestep and return target angles.

        Uses Euler integration of the Kuramoto phase dynamics:
          dphi_i = 2*pi*f_i + sum_j(w_ij * sin(phi_j - phi_i + Phi_ij))
          phi_i += dphi_i * dt

        Args:
            dt: timestep in seconds (typically 1/60).

        Returns:
            list of 6 floats — target joint angles in radians.
        """
        new_phases = [0.0] * 6

        for i in range(6):
            # Natural frequency contribution
            dphi = 2.0 * math.pi * self.frequencies[i]

            # Coupling from other oscillators arriving at i
            for from_osc, weight, phase_offset in self.connections_to[i]:
                phase_diff = self.phases[from_osc] - self.phases[i] + phase_offset
                dphi += weight * math.sin(phase_diff)

            # Clamp phase rate to prevent explosion
            dphi = max(-MAX_DPHI, min(MAX_DPHI, dphi))

            # Euler integration
            new_phases[i] = self.phases[i] + dphi * dt

        self.phases = new_phases

        # Output: target angle = amplitude * sin(phase)
        return [self.amplitudes[i] * math.sin(self.phases[i]) for i in range(6)]

    def get_targets(self, t, dt):
        """Interface method for the simulation loop.

        Args:
            t: current simulation time (unused by CPG — it tracks state internally).
            dt: timestep in seconds.

        Returns:
            list of 6 floats — target joint angles in radians.
        """
        return self.step(dt)


# ---------------------------------------------------------------------------
# Population seeding (cascade: sine -> CPG)
# ---------------------------------------------------------------------------

def initialize_cpg_population(pop_size, best_sine_chromosomes):
    """Create a CPG population seeded from the best sine (v1) creatures.

    Seeds ALL individuals from sine templates — this is critical for
    Risk 1 mitigation (Section 28 of spec).  If only a few individuals
    are seeded, the 95% random population dilutes the walking knowledge
    and the GA wastes generations rediscovering walking instead of
    learning coupling.

    Seeding strategy:
      - Oscillator genes (0-17): copied from a random sine template
        with +/-3% Gaussian noise (preserves inherited gait)
      - Coupling genes (18-37): all set to 0.5 (neutral coupling,
        since (0.5-0.5)*4 = 0 weight → no inter-oscillator influence)

    Args:
        pop_size: number of individuals in the CPG population.
        best_sine_chromosomes: list of np.ndarray (each shape (18,)),
            the top-performing sine chromosomes from v1 evolution.
            Typically the best chromosome from each of the top 5-10 runs.

    Returns:
        list of np.ndarray — pop_size chromosomes, each shape (38,).
    """
    assert len(best_sine_chromosomes) > 0, \
        "Need at least one sine chromosome to seed from"

    population = []
    for _ in range(pop_size):
        # Pick a random template from the sine champions
        template = random.choice(best_sine_chromosomes)
        assert len(template) >= 18, \
            f"Sine chromosome should be 18 genes, got {len(template)}"

        chromo = np.zeros(38, dtype=np.float64)

        # Copy oscillator genes with +/-3% noise
        for j in range(18):
            noisy = template[j] + np.random.normal(0, 0.03)
            chromo[j] = np.clip(noisy, 0.0, 1.0)

        # Set coupling genes to neutral (0.5 → weight=0, phase_offset=pi)
        chromo[18:38] = 0.5

        population.append(chromo)

    return population
