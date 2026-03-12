# Threats to Validity — Additional Notes for Phase D Report

These are threats/limitations identified during Phase B implementation that
should be documented in the report's Threats to Validity section (Section 6).
Phase D spec already covers some threats — these are ADDITIONS not duplicates.

---

## 1. FDC 5-Second vs 15-Second Simulation Duration

**Threat**: The FDC (Fitness Distance Correlation) analysis uses 5-second
simulations for speed, but the main experiments use 15-second simulations.
If the fitness landscape structure differs between 5s and 15s evaluations,
the FDC results may not accurately characterize the landscape the GA
actually optimized over.

**Mitigation**: A Spearman rank correlation validation is performed between
5s and 15s fitness values on 100 random chromosomes. If rho >= 0.9, the
short evaluations preserve relative fitness ranking and the FDC results
are trustworthy. The actual rho value is reported in results.

**Reference**: `landscape_analysis.py`, `validate_fdc_duration()`.

---

## 2. Epistasis Reference Point Sensitivity

**Threat**: Epistasis measurements depend on the chosen reference point in
the fitness landscape. A single reference point may produce misleading
interaction strengths if it sits near a ridge, saddle point, or local optimum.

**Mitigation**: Epistasis is computed at 5 reference points (best chromosome
+ 4 random) and averaged. A consistency metric (std/mean ratio) is reported
per gene pair. Pairs with high inconsistency should be interpreted cautiously.

**Reference**: `landscape_analysis.py`, `compute_epistasis_robust()`.

---

## 3. Simulator Inconsistency: v1 vs v2

**Threat**: Sine controllers are evaluated with `simulate()` (v1) during
training, but CPG and CPG+NN use `simulate_v2()` (v2). If the two simulator
implementations produce systematically different results, cross-controller
comparisons (e.g., sine vs CPG fitness in Table 1) may be biased.

**Mitigation**: A simulator consistency check computes Spearman rank
correlation between v1 and v2 fitness for the same set of sine chromosomes.
High correlation (rho > 0.9) indicates the simulators agree on relative
fitness ordering. The mean absolute difference is also reported.

**Reference**: `transfer_test.py`, `simulator_consistency_check()`.

---

## 4. Sensor Ablation Running Mean vs Zero Replacement

**Threat**: Sensor ablation replaces sensors with their running mean (not
zero) to avoid injecting false information. However, the running mean itself
carries information about the average operating state — it is not truly
uninformative. A constant mean foot contact of 0.6 tells the NN "foot is
usually on the ground", which may allow partial compensation.

**Mitigation**: The choice of running mean is explicitly stated in the
methods section. An alternative "frozen-NN" control experiment provides a
complementary measure: if CPG+NN significantly outperforms frozen-NN, the
NN is using sensors regardless of ablation methodology.

**Reference**: `sensor_ablation.py`, open-loop deviation check.

---

## 5. Gait Symmetry Incommensurate Frequency Exclusion

**Threat**: Sine creatures with hip frequencies differing by >10% are
excluded from gait symmetry analysis because their phase difference sweeps
through all values continuously. This exclusion may bias the reported
symmetry statistics for sine controllers if many evolved creatures have
mismatched frequencies.

**Mitigation**: The number of excluded creatures is reported alongside the
results (e.g., "X/30 sine creatures had incommensurate frequencies").
The exclusion rate itself is informative: it demonstrates that sine
evolution does not naturally discover matched frequencies, while CPG
coupling enforces frequency synchronization — supporting the paper's thesis.

**Reference**: `gait_analysis.py`, `compute_gait_symmetry_sine()`.

---

## 6. Foot Contact Sensor Timing (Post-Hoc Bug Fix)

**Threat**: During Phase B implementation, a bug was discovered in the foot
contact tracking system. The pymunk collision callback was using `begin`
(fires only when shapes first overlap) instead of `pre_solve` (fires every
physics step while shapes overlap). Combined with the per-step contact
reset pattern, this meant foot contacts were always read as `False` during
Phase A training of CPG+NN controllers.

The CPG+NN creatures were trained with this bug — meaning the NN
optimized its weights assuming foot_L_contact is always 0. The bug was
fixed for Phase B analysis by switching to `pre_solve` and reading sensors
after the physics step. This creates a train/evaluate mismatch: Phase B
results (sensor ablation, gait analysis) use the corrected sensor timing,
but the NN weights were optimized for the buggy timing.

**Impact**: CPG+NN flat fitness dropped from ~949 (Phase A training) to
~368 (Phase B corrected evaluation). Sensor ablation and gait metrics
are internally consistent (both baseline and ablated use corrected timing),
but absolute fitness values differ from training.

**Mitigation**: Phase B analysis focuses on *relative* comparisons (e.g.,
ablated vs baseline fitness drop), which remain valid because both
conditions use the same (corrected) sensor timing. The foot contact
bug actually provides an additional finding: the NN learned to modulate
gaits effectively without foot contact information, relying instead on
hip angles and torso angle for balance control.

**Reference**: `src/sensors.py`, `setup_foot_contact_tracking()`;
`src/physics_sim.py`, `simulate_v2()` sensor read order.
