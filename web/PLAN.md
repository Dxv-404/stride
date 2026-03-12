# Joint Dragging Feature — Implementation Plan

## Overview
Allow users to drag joint markers to rotate bones in the SkinnedMesh model.
On release, bones spring back to rest pose with realistic physics (damped spring).

## User Decisions
- **Snap-back**: Yes, with realistic damped spring physics
- **Tooltip during drag**: Hide it
- **Visual feedback**: Full creative freedom
- **Mobile**: Skip for now (desktop pointer events only)

---

## Files to Modify

### 1. `jointData.ts` — Add rotation constraints per joint
- Add `draggable: boolean` to JointInfo (motorized + spring joints only)
- Add `dragAxis: 'x' | 'y' | 'xy'` — which rotation axes the joint supports
- Add `rotationLimits: { xMin, xMax, zMin, zMax }` — anatomical constraints in radians
- Add `dragSensitivity: number` — pixels-to-radians multiplier (default 0.005)
- Set constraints for each joint:
  - Hips: xy drag, +-90deg flex, +-30deg abduction
  - Knees: x only (single axis bend), 0 to 140deg
  - Shoulders: xy drag, wide range
  - Elbows: x only, 0 to 145deg

### 2. `landingStore.ts` — Add drag state
- `isDraggingJoint: boolean` — true during active drag
- `setIsDraggingJoint: (v: boolean) => void`
- When `isDraggingJoint` is true, tooltip is hidden (HumanSection reads this)

### 3. `useScrollTimeline.ts` — Add SceneState flag
- Add `isDraggingJoint: boolean` to SceneState interface
- Initialize as `false` in createInitialState()
- This mutable ref is read by ConditionalOrbitControls to disable orbit during drag

### 4. `R3FHelpers.tsx` — Expose OrbitControls enabled toggle
- Add `enabled?: boolean` prop to OrbitControls component
- When `enabled` is false, set `controls.enabled = false` (stops all orbit interaction)
- This is cleaner than unmounting/remounting the controls

### 5. `ScrollCanvas.tsx` — Pass drag state to OrbitControls
- In ConditionalOrbitControls, read `isDraggingJoint` from sceneStateRef
- Pass `enabled={!isDragging}` to OrbitControls
- This disables orbit rotation while a joint is being dragged

### 6. `JointMarker.tsx` — Core drag logic (~100 lines new code)
**New event handlers:**
- `onPointerDown`: Record start mouse position + bone's current rotation.
  Set `isDraggingJoint=true` in both store and sceneState.
  Call `e.target.setPointerCapture(e.pointerId)` so moves track even outside canvas.
  Change cursor to 'grabbing'.
- `onPointerMove`: If dragging, compute mouse delta from start position.
  Convert delta to bone rotation using camera-relative vectors.
  Apply rotation with clamping to joint limits.
  Update `bone.rotation` directly (SkinnedMesh auto-deforms).
- `onPointerUp`: Clear drag state. Start spring-back animation.
  Change cursor back.

**Click vs drag disambiguation:**
- Track cumulative pointer movement in pixels
- If total movement < 5px on pointerup → treat as click (toggle selection)
- If total movement >= 5px → was a drag (don't toggle selection)

**Camera-relative rotation mapping:**
- Horizontal mouse delta → bone rotation around world Y axis
- Vertical mouse delta → bone rotation around bone's local X axis
- Multiply by `dragSensitivity` from jointData

**Spring-back physics (useFrame):**
- Store `restRotation` (bone's original rotation from the GLB)
- On release, apply damped spring equation each frame:
  ```
  velocity += (restRotation - currentRotation) * stiffness
  velocity *= damping
  bone.rotation += velocity
  ```
- Stiffness ~8, damping ~0.85 → snappy but organic snap-back
- Stop animation when velocity < threshold and position < threshold

**Visual feedback during drag:**
- Marker scales up slightly (0.35 → 0.42)
- Opacity goes full white (1.0)
- Outer reticle ring appears (same as selected state)
- Cursor: 'grab' on hover (if draggable), 'grabbing' during drag
- A faint arc/trail showing rotation angle would be premium but optional

### 7. `HumanSection.tsx` — Hide tooltip during drag
- Read `isDraggingJoint` from landingStore
- When true, don't render the tooltip card or connector line
- Tooltip reappears on release (if joint is still selected)

---

## Implementation Order
1. `jointData.ts` — Add constraints data (foundation)
2. `landingStore.ts` — Add drag state
3. `useScrollTimeline.ts` — Add SceneState flag
4. `R3FHelpers.tsx` — Add enabled prop
5. `ScrollCanvas.tsx` — Wire drag state to OrbitControls
6. `JointMarker.tsx` — Core drag + spring-back logic
7. `HumanSection.tsx` — Hide tooltip during drag
8. Verify in browser — test each joint, check spring-back, confirm orbit still works

## Non-goals (skip for now)
- Mobile touch support
- IK solver
- Rotation arc visualization
- Sound effects
