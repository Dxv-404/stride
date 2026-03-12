# PHASE E: Interactive Website

**Give this entire file to Claude Code. Can run in parallel with Phase D (report).**

## Context

All Python work is complete. JSON data for the website exists in experiments/results/web_export/ (from Phase B, export_for_web.py). The website is a standalone React application — it does NOT depend on the Python backend running.

Read stride_v3.md Sections 12, 13, 14, 15, 16, and 27 for full specifications and implementation code.

## Tech Stack

- React + TypeScript (Vite project in web/ directory)
- p2.js (CDN: https://cdnjs.cloudflare.com/ajax/libs/p2.js/0.7.1/p2.min.js) — 2D physics
- Canvas2D — rendering (p2.js is headless)
- Recharts — interactive charts for results dashboard
- Tailwind CSS — styling
- Web Workers — GA evolution off main thread (Tab 1 only)

**Color palette** (from Section 12): Background #0F172A, Cards #1E293B, Borders #334155, Sine #3B82F6, CPG #10B981, CPG+NN #F59E0B, Text primary #F1F5F9, Text secondary #94A3B8, Canvas #111827, Ground #4ADE80

**Typography**: "STRIDE" title in bold monospace. Headers: clean sans-serif uppercase. Data: monospace for numbers/genes.

## What To Do — Build in Priority Order

### P0 Core (must have — ~16 hours)

**Step 1: p2.js Creature Module** (~4-5h)

Read stride_v3.md Section 27 "p2.js Creature Module". Copy createCreature() function.

Create the core physics engine module:
- createCreature(world, x, y, genes, controllerType) — builds stick figure with p2.js bodies, RevoluteConstraints with motors, feet, passive elbows/ankles
- SineController, CPGController, CPGNNController classes — copy from Section 27 "JS Controller Classes"
- createTerrain(world, terrainType) — copy from Section 27 "Terrain Creation" (flat, hill, mixed)
- drawCreature(ctx, creature, cameraX) — custom Canvas2D renderer (Section 27 "Custom Canvas Renderer")

Key p2.js notes (from spec Section 12 "p2.js ↔ pymunk API Mapping"):
- p2.js uses y-UP coordinates. Canvas uses y-DOWN. Flip y when rendering.
- RevoluteConstraint combines PivotJoint + RotaryLimitJoint + SimpleMotor from pymunk
- `joint.enableMotor()`, `joint.setMotorSpeed(speed)`, `joint.setLimits(lo, hi)`
- Collision filtering: shape.collisionGroup=0x0002, shape.collisionMask=0x0001 (creature only hits ground)
- PD controller: motorSpeed = Kp × (target - current), Kp = 20.0
- Velocity clamping: check every step, cap at 1000

**Step 2: Tab 4 — Gene Playground** (~2-3h)

Read stride_v3.md Section 13 "Tab 4: GENE PLAYGROUND". Copy GenePlayground component code.

- Creature walking on left canvas, 18 sliders on right
- Sliders grouped by joint: Hip L/R (blue), Knee L/R (green), Shoulder L/R (orange)
- Each joint: Amplitude, Frequency, Phase sliders [0, 1]
- Real-time: changing sliders immediately changes creature's gait
- Presets: Best Evolved Walker, Random, All Zero, Symmetric, Hopping, Crawling, Moonwalk
- Fitness readout, distance counter
- "Challenge: Can you beat the GA?" display

**Step 3: Tab 3 — Push Test** (~1-2h)

Read stride_v3.md Section 13 "Tab 3: PUSH TEST". Copy PushTest component code.

- **Single most impressive demo**
- Creature walking, PUSH button (or spacebar)
- Push strength slider (500/1000/1500/2000)
- Controller selector (sine/CPG/CPG+NN)
- BACKWARD push (negative x-force) — Errata Fix 1
- Verdict after 3 seconds: "✓ RECOVERED" (green) or "✗ FELL" (red) + recovery time
- Key demo: push sine → falls. Push CPG+NN → recovers.

**Step 4: Tab 2 — Controller Race** (~2-3h)

Read stride_v3.md Section 13 "Tab 2: CONTROLLER COMPARISON". Copy ControllerRace code.

- 3 side-by-side canvases: Sine (blue), CPG (green), CPG+NN (amber)
- Pre-loaded with best chromosomes from web_export JSON
- Terrain selector (Flat/Hill/Mixed)
- Timer, distance markers
- "Winner" highlight when one clearly leads

**Step 5: Particle Effects + Ghost Trail** (~3-4h)

Read stride_v3.md Section 14 "Core Visual System".

- Foot dust particles on ground contact (tiny circles that fade out)
- Screen shake on push (Tab 3) — shake canvas by ±3px for 0.3s
- Ghost trail / afterimage: fading copies of creature pose every 10 frames, alpha decreasing
- These attach to ALL creature canvases across all tabs

---

### P1 Should-Have (~15 hours)

**Step 6: Tab 1 — Live Evolution** (~3-4h)

Read stride_v3.md Section 13 "Tab 1: HERO". ~400-500 lines, hardest tab.

- Full GA runs in Web Worker (p2.js works in workers — no DOM needed)
- Each generation: all creatures simulated (3-second sims for speed), best creature rendered on main canvas
- Fitness-over-generations line chart below (updates in real time via Recharts)
- Controls: Play/Pause, Speed (1×/2×/5×/10×), Reset, Population Size slider (20-100)
- Camera follows creature

**Step 7: Tab 5 — Results Dashboard** (~3-4h)

Read stride_v3.md Section 13 "Tab 5: RESULTS DASHBOARD".

- Load data from web_export JSON files
- 7 Recharts components:
  1. Convergence plots (toggleable series, shaded std bands)
  2. Transfer heatmap (4×5 colored grid)
  3. Push test results (grouped bar chart)
  4. Fitness distributions (box plots)
  5. Statistical significance table (p-values, Cohen's d, stars)
  6. FDC scatter (2000 points with hover)
  7. Epistasis matrix heatmap (18×18)

**Step 8: Tab 6 — About** (~2-3h)

Read stride_v3.md Section 13 "Tab 6: ABOUT".

- Project description, controller architecture diagrams
- GA flowchart, notation table
- PDF download link, GitHub link
- Note: "Live sims use p2.js (close to pymunk). Stats from pymunk (exact)."

**Step 9: Visual Enhancements** (~4-6h)
- Muscle heatmap overlay (color limbs by torque, toggle with 'M' key)
- X-Ray / blueprint mode (wireframe with joint angles displayed)
- Cinematic camera modes (follow, fixed, slow zoom)
- DNA sharing via URL (encode chromosome as base64 in URL hash)

---

### P2 Nice-to-Have (~15 hours)

**Step 10: 3D Fitness Landscape** (Three.js r128, 4-5h) — Section 14
**Step 11: Leaderboard** (persistent storage API, 2-3h) — Section 14
**Step 12: GIF Export** (1-2h) — Section 14
**Step 13: Slow-motion Push Replay** (2-3h) — Section 14
**Step 14: Generational Morph Timeline** (1-2h) — Section 14
**Step 15: Matrix Rain Background** (1h) — Section 14

### P3 Stretch Goals (~20+ hours)

**Step 16: Chromosome Editor "Gene Lab"** — stride_v3.md Section 15
- 6 layers: Raw gene editor, visual joint timeline (DAW-style), preset library with blending, constraint editor, macro recorder, diff view
- Complex feature, only if significantly ahead

**Step 17: Terrain Editor "World Builder"** — stride_v3.md Section 16
- Drawing canvas, terrain tools toolbar, presets, properties panel, terrain layers, challenge builder
- Complex feature, only if significantly ahead

---

## Minimum Viable "Wow" (if only 2 days)

If short on time, build ONLY:
1. p2.js creature + 3 controllers (Step 1)
2. Tab 3 (Push Test) with particles + screen shake (Steps 3 + 5)
3. Tab 4 (Gene Playground) with sliders (Step 2)
4. Tab 2 (Controller Race) (Step 4)

This is ~16 hours and gives the most impressive demo. Tab 3 (push test) alone is the most memorable feature.

## Project Structure

```
web/
├── src/
│   ├── engine/
│   │   ├── creature.ts        # createCreature(), drawCreature()
│   │   ├── controllers.ts     # SineController, CPGController, CPGNNController
│   │   ├── terrain.ts         # createTerrain()
│   │   ├── particles.ts       # dust, screen shake effects
│   │   └── ga-worker.ts       # Web Worker for Tab 1
│   ├── components/
│   │   ├── CreatureCanvas.tsx  # Reusable canvas with physics loop
│   │   ├── GeneSliders.tsx     # Slider group component
│   │   └── Navigation.tsx      # Tab navigation bar
│   ├── pages/
│   │   ├── Hero.tsx            # Tab 1: Live Evolution
│   │   ├── Compare.tsx         # Tab 2: Controller Race
│   │   ├── PushTest.tsx        # Tab 3: Push Test
│   │   ├── Playground.tsx      # Tab 4: Gene Playground
│   │   ├── Results.tsx         # Tab 5: Dashboard
│   │   └── About.tsx           # Tab 6: About
│   ├── data/
│   │   └── best-chromosomes.ts # Pre-loaded from web_export JSON
│   └── App.tsx
├── public/
│   └── data/                   # JSON files from export_for_web.py
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Physics Fidelity Note (from spec)
p2.js creature will be qualitatively similar to pymunk. Both use similar constraint solvers, RevoluteConstraints with motors, and angle limits. Live simulations (Tabs 1-4) use p2.js physics. Statistical results (Tab 5) show REAL pymunk experiment data. Minor numerical differences are expected.

## Success Criteria
- [ ] p2.js creature walks on screen without physics explosion
- [ ] All 3 controllers (sine, CPG, CPG+NN) produce visually different gaits
- [ ] Tab 3: pushing sine → falls, pushing CPG+NN → recovers
- [ ] Tab 4: sliders change creature's gait in real time
- [ ] Tab 2: 3 creatures walk side by side
- [ ] Particle effects visible on ground contact
- [ ] Ghost trail shows creature's motion history
- [ ] Dark theme with spec color palette
- [ ] Best chromosomes loaded from web_export data
- [ ] No physics explosions (velocities clamped)

## Estimated Time
- P0 only: ~16 hours
- P0 + P1: ~31 hours
- P0 + P1 + P2: ~46 hours
- P0 + P1 + P2 + P3: ~66+ hours
