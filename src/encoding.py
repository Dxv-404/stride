"""Direct & indirect chromosome encoding for creature joint parameters.

Direct encoding:  18 genes -> 6 joints x 3 params (amp, freq, phase)
Indirect encoding: 9 genes -> 3 joint types, mirrored L/R with pi phase shift
"""

import math


def decode_direct(chromosome):
    """Decode 18 normalized [0,1] genes to actual parameter ranges.

    Returns:
        list of 6 tuples: [(amplitude, frequency, phase), ...]
        Order: hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R
    """
    params = []
    for i in range(6):
        amp = chromosome[i * 3 + 0] * (math.pi / 2)       # [0, pi/2]
        freq = chromosome[i * 3 + 1] * 4.5 + 0.5           # [0.5, 5.0]
        phase = chromosome[i * 3 + 2] * (2 * math.pi)       # [0, 2*pi]
        params.append((amp, freq, phase))
    return params


def decode_indirect(chromosome):
    """Decode 9 normalized [0,1] genes, mirror left to right with pi phase shift.

    Gene layout: [hip_amp, hip_freq, hip_phase,
                  knee_amp, knee_freq, knee_phase,
                  shoulder_amp, shoulder_freq, shoulder_phase]

    Returns:
        list of 6 tuples: [(amplitude, frequency, phase), ...]
        Order: hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R
    """
    params = []
    for i in range(3):  # hip, knee, shoulder
        amp = chromosome[i * 3 + 0] * (math.pi / 2)
        freq = chromosome[i * 3 + 1] * 4.5 + 0.5
        phase = chromosome[i * 3 + 2] * (2 * math.pi)
        # Left side
        params.append((amp, freq, phase))
        # Right side: same amp and freq, phase offset by pi
        right_phase = (phase + math.pi) % (2 * math.pi)
        params.append((amp, freq, right_phase))
    return params


def decode_chromosome(chromosome, encoding_type="direct"):
    """Decode a chromosome using the specified encoding type.

    Args:
        chromosome: numpy array of normalized [0,1] gene values.
        encoding_type: "direct" (18 genes) or "indirect" (9 genes).

    Returns:
        list of 6 (amplitude, frequency, phase) tuples.
    """
    if encoding_type == "direct":
        assert len(chromosome) == 18, \
            f"Direct encoding requires 18 genes, got {len(chromosome)}"
        return decode_direct(chromosome)
    elif encoding_type == "indirect":
        assert len(chromosome) == 9, \
            f"Indirect encoding requires 9 genes, got {len(chromosome)}"
        return decode_indirect(chromosome)
    else:
        raise ValueError(f"Unknown encoding: {encoding_type}")


def get_gene_count(encoding_type="direct"):
    """Return the number of genes for the given encoding type.

    Encoding types:
        direct:   18 genes — 6 joints x 3 params (amp, freq, phase)
        indirect:  9 genes — 3 joint types, mirrored L/R
        cpg:      38 genes — 18 oscillator + 20 coupling (v2)
        cpg_nn:   96 genes — 38 CPG + 58 NN weights (v2)
    """
    counts = {"direct": 18, "indirect": 9, "cpg": 38, "cpg_nn": 96}
    if encoding_type not in counts:
        raise ValueError(f"Unknown encoding: {encoding_type}")
    return counts[encoding_type]
