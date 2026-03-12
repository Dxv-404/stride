/**
 * JointMarker — Distinct wireframe icon + HUD reticle at each skeleton joint.
 *
 * Each joint type renders a unique wireframe geometry:
 *   - motorized → wireframe gear (6 teeth, slow rotation)
 *   - spring    → wireframe helix/coil (compress-extend oscillation)
 *   - reference → wireframe octahedron (slow pulse)
 *   - fixed     → small wireframe diamond (subtle)
 *   - visual    → crosshair lines (dim)
 *
 * All icons sit inside a HUD reticle ring system that billboards toward
 * the camera. Progressive disclosure: idle → hover → selected adds
 * visual layers (inner ring always, middle ring on hover, outer ring +
 * corner ticks on selection).
 *
 * renderOrder={10+} and depthTest:false ensure markers always draw on
 * top of the wireframe mesh regardless of camera angle.
 *
 * VISIBILITY: Reads `jointMarkersVisible` from sceneStateRef in useFrame.
 * Markers rendered OUTSIDE WireframeHuman group (world space) so
 * bone.getWorldPosition() gives correct placement.
 */

import { useRef, useState, useMemo, useCallback } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useLandingStore } from '@/stores/landingStore.ts'
import { MARKER_COLOR, MARKER_COLOR_ACTIVE, JOINT_OPACITY } from './jointData.ts'
import type { JointInfo, JointType } from './jointData.ts'
import type { SceneState } from './useScrollTimeline.ts'

/* ── Spring-back physics constants ── */
const SPRING_STIFFNESS = 10    // spring force multiplier (higher = snappier)
const SPRING_DAMPING = 0.78    // velocity decay per frame (lower = more damped)
const SPRING_THRESHOLD = 0.001 // stop animation when velocity + displacement below this
const DRAG_CLICK_THRESHOLD = 5 // pixels: below this = click, above = drag

interface JointMarkerProps {
  bone: THREE.Bone
  info: JointInfo
  sceneStateRef: React.RefObject<SceneState>
}

/* ═══════════════════════════════════════════════════════════════════
 *  ICON GEOMETRY FACTORIES
 *  Each returns a BufferGeometry in wireframe-friendly form.
 *  Geometries are unit-sized (radius ≈ 1) — scaled by the marker.
 * ═══════════════════════════════════════════════════════════════════ */

/** Wireframe gear — 6 teeth radiating from a ring */
function createGearGeometry(): THREE.BufferGeometry {
  const points: number[] = []
  const teeth = 6
  const innerR = 0.55
  const outerR = 1.0
  const toothWidth = 0.22 // half-width in radians

  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2
    const nextAngle = ((i + 1) / teeth) * Math.PI * 2

    // Inner ring segment (between teeth)
    const segSteps = 4
    for (let s = 0; s < segSteps; s++) {
      const a1 = angle + toothWidth + (nextAngle - angle - toothWidth * 2) * (s / segSteps)
      const a2 = angle + toothWidth + (nextAngle - angle - toothWidth * 2) * ((s + 1) / segSteps)
      points.push(
        Math.cos(a1) * innerR, Math.sin(a1) * innerR, 0,
        Math.cos(a2) * innerR, Math.sin(a2) * innerR, 0,
      )
    }

    // Tooth: inner-left → outer-left → outer-right → inner-right
    const aL = angle - toothWidth
    const aR = angle + toothWidth
    points.push(
      Math.cos(aL) * innerR, Math.sin(aL) * innerR, 0,
      Math.cos(aL) * outerR, Math.sin(aL) * outerR, 0,
    )
    points.push(
      Math.cos(aL) * outerR, Math.sin(aL) * outerR, 0,
      Math.cos(aR) * outerR, Math.sin(aR) * outerR, 0,
    )
    points.push(
      Math.cos(aR) * outerR, Math.sin(aR) * outerR, 0,
      Math.cos(aR) * innerR, Math.sin(aR) * innerR, 0,
    )
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/** Wireframe spring/helix coil — sine wave wrapped in a circle */
function createSpringGeometry(): THREE.BufferGeometry {
  const points: number[] = []
  const coils = 3
  const segments = 60
  const radius = 0.7
  const amplitude = 0.3

  for (let i = 0; i < segments; i++) {
    const t1 = i / segments
    const t2 = (i + 1) / segments
    const a1 = t1 * Math.PI * 2
    const a2 = t2 * Math.PI * 2
    const r1 = radius + Math.sin(t1 * coils * Math.PI * 2) * amplitude
    const r2 = radius + Math.sin(t2 * coils * Math.PI * 2) * amplitude

    points.push(
      Math.cos(a1) * r1, Math.sin(a1) * r1, 0,
      Math.cos(a2) * r2, Math.sin(a2) * r2, 0,
    )
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/** Wireframe octahedron — 6 vertices, 12 edges */
function createOctahedronGeometry(): THREE.BufferGeometry {
  const s = 0.85
  // 6 vertices: ±x, ±y, ±z
  const verts = [
    [s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s], [0, 0, -s],
  ]
  // 12 edges connecting each axis-aligned vertex to the 4 non-opposing vertices
  const edges = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [2, 5], [3, 4], [3, 5],
  ]

  const points: number[] = []
  for (const [a, b] of edges) {
    points.push(...verts[a], ...verts[b])
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/** Small wireframe diamond (compressed octahedron) */
function createDiamondGeometry(): THREE.BufferGeometry {
  const sx = 0.5, sy = 0.8, sz = 0.5
  const verts = [
    [sx, 0, 0], [-sx, 0, 0], [0, sy, 0], [0, -sy, 0], [0, 0, sz], [0, 0, -sz],
  ]
  const edges = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [2, 5], [3, 4], [3, 5],
  ]

  const points: number[] = []
  for (const [a, b] of edges) {
    points.push(...verts[a], ...verts[b])
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/** Crosshair — 4 lines extending from center gap */
function createCrosshairGeometry(): THREE.BufferGeometry {
  const inner = 0.3
  const outer = 0.9
  const points = [
    // Horizontal
    -outer, 0, 0, -inner, 0, 0,
    inner, 0, 0, outer, 0, 0,
    // Vertical
    0, -outer, 0, 0, -inner, 0,
    0, inner, 0, 0, outer, 0,
  ]

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/** Map joint type to its geometry factory */
const GEOMETRY_FACTORIES: Record<JointType, () => THREE.BufferGeometry> = {
  motorized: createGearGeometry,
  spring: createSpringGeometry,
  reference: createOctahedronGeometry,
  fixed: createDiamondGeometry,
  visual: createCrosshairGeometry,
}

/* ═══════════════════════════════════════════════════════════════════
 *  RETICLE RING GEOMETRY
 *  Dashed/ticked circles that billboard toward the camera.
 * ═══════════════════════════════════════════════════════════════════ */

/** Create a dashed circle ring as line segments */
function createReticleRing(radius: number, dashes: number, gapRatio = 0.3): THREE.BufferGeometry {
  const points: number[] = []
  const totalSegments = dashes * 2 // dash + gap alternating
  const segmentAngle = (Math.PI * 2) / totalSegments
  const steps = 6 // smoothness per dash

  for (let i = 0; i < totalSegments; i += 2) {
    // Only draw the dash segments (even indices), skip gaps (odd)
    const startAngle = i * segmentAngle + segmentAngle * gapRatio * 0.5
    const endAngle = (i + 1) * segmentAngle - segmentAngle * gapRatio * 0.5

    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (endAngle - startAngle) * (s / steps)
      const a2 = startAngle + (endAngle - startAngle) * ((s + 1) / steps)
      points.push(
        Math.cos(a1) * radius, Math.sin(a1) * radius, 0,
        Math.cos(a2) * radius, Math.sin(a2) * radius, 0,
      )
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/** Create corner tick marks at 4 cardinal points */
function createCornerTicks(radius: number, tickLen = 0.15): THREE.BufferGeometry {
  const points: number[] = []
  const cardinals = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]

  for (const angle of cardinals) {
    const x1 = Math.cos(angle) * radius
    const y1 = Math.sin(angle) * radius
    const x2 = Math.cos(angle) * (radius + tickLen)
    const y2 = Math.sin(angle) * (radius + tickLen)
    points.push(x1, y1, 0, x2, y2, 0)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geo
}

/* ═══════════════════════════════════════════════════════════════════
 *  JOINT MARKER COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */

export default function JointMarker({ bone, info, sceneStateRef }: JointMarkerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const iconRef = useRef<THREE.Group>(null)
  const reticleRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const setSelectedJoint = useLandingStore((s) => s.setSelectedJoint)
  const setJointScreenPos = useLandingStore((s) => s.setJointScreenPos)
  const setIsDraggingJoint = useLandingStore((s) => s.setIsDraggingJoint)
  const selectedJoint = useLandingStore((s) => s.selectedJoint)
  const isSelected = selectedJoint === info.boneName
  const { camera, gl } = useThree()

  // ── Drag state (refs to avoid re-renders during 60fps dragging) ──
  const isDragging = useRef(false)
  const dragStartMouse = useRef({ x: 0, y: 0 })
  const dragStartRotX = useRef(0)
  const dragStartRotZ = useRef(0)
  const totalDragDistance = useRef(0)

  // ── Spring-back state ──
  const isSpringBack = useRef(false)
  const restRotX = useRef(0)
  const restRotZ = useRef(0)
  const velocityX = useRef(0)
  const velocityZ = useRef(0)
  const restCaptured = useRef(false) // capture rest rotation once from GLB default

  // Memoize geometries so they're created once per marker
  const iconGeo = useMemo(() => GEOMETRY_FACTORIES[info.type](), [info.type])
  const innerRing = useMemo(() => createReticleRing(1.3, 32, 0.1), [])
  const middleRing = useMemo(() => createReticleRing(1.7, 16, 0.4), [])
  const outerRing = useMemo(() => createReticleRing(2.1, 8, 0.5), [])
  const ticks = useMemo(() => createCornerTicks(2.1, 0.2), [])

  // Monochromatic: single silver color, opacity differentiates types
  const baseColor = useMemo(() => new THREE.Color(MARKER_COLOR), [])
  const activeColor3 = useMemo(() => new THREE.Color(MARKER_COLOR_ACTIVE), [])
  const typeOpacity = JOINT_OPACITY[info.type]

  const canDrag = info.draggable === true

  // ── Capture rest rotation from the GLB bind pose (once) ──
  if (!restCaptured.current && bone) {
    restRotX.current = bone.rotation.x
    restRotZ.current = bone.rotation.z
    restCaptured.current = true
  }

  // ── Drag handlers ──
  // Uses native DOM events for move/up during drag because R3F's onPointerMove
  // only fires while the raycaster intersects the object's geometry. Once the
  // cursor moves outside the marker's hit sphere, R3F stops sending moves.
  // Native DOM events on the canvas track the mouse regardless of 3D position.
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!canDrag || !info.rotationLimits) return
    e.stopPropagation()

    const nativeEvt = e.nativeEvent
    const canvas = gl.domElement

    // Stop the native event from reaching OrbitControls (which also listens
    // on the canvas). stopImmediatePropagation prevents other listeners on
    // the SAME element from seeing this event.
    nativeEvt.stopImmediatePropagation()

    isDragging.current = true
    isSpringBack.current = false  // cancel any running spring-back
    dragStartMouse.current = { x: nativeEvt.clientX, y: nativeEvt.clientY }
    dragStartRotX.current = bone.rotation.x
    dragStartRotZ.current = bone.rotation.z
    totalDragDistance.current = 0
    velocityX.current = 0
    velocityZ.current = 0

    // Signal to OrbitControls + tooltip
    setIsDraggingJoint(true)
    if (sceneStateRef.current) sceneStateRef.current.isDraggingJoint = true
    document.body.style.cursor = 'grabbing'

    // Capture the rotation limits and sensitivity in closure
    const limits = info.rotationLimits
    const sensitivity = info.dragSensitivity ?? 0.005
    const dragAxis = info.dragAxis

    // Native DOM move handler — fires regardless of raycaster state
    // Limits are RELATIVE to the bind-pose rest rotation (restRotX/Z),
    // not absolute values. GLB skeletons often have large bind-pose rotations.
    const baseX = restRotX.current
    const baseZ = restRotZ.current

    const onDomMove = (evt: PointerEvent) => {
      const dx = evt.clientX - dragStartMouse.current.x
      const dy = evt.clientY - dragStartMouse.current.y
      totalDragDistance.current = Math.sqrt(dx * dx + dy * dy)

      // Vertical mouse drag → bone X rotation (flex/extend)
      const newRotX = dragStartRotX.current + dy * sensitivity
      bone.rotation.x = Math.max(baseX + limits.xMin, Math.min(baseX + limits.xMax, newRotX))

      // Horizontal mouse drag → bone Z rotation (abduction) — only for 'xy' drag
      if (dragAxis === 'xy') {
        const newRotZ = dragStartRotZ.current + dx * sensitivity
        bone.rotation.z = Math.max(baseZ + limits.zMin, Math.min(baseZ + limits.zMax, newRotZ))
      }
    }

    // Native DOM up handler — cleanup + spring-back
    const onDomUp = () => {
      canvas.removeEventListener('pointermove', onDomMove)
      canvas.removeEventListener('pointerup', onDomUp)
      canvas.removeEventListener('lostpointercapture', onDomUp)
      try { canvas.releasePointerCapture(nativeEvt.pointerId) } catch (_) { /* already released */ }

      const wasDrag = totalDragDistance.current >= DRAG_CLICK_THRESHOLD
      isDragging.current = false

      // Clear drag flags
      setIsDraggingJoint(false)
      if (sceneStateRef.current) sceneStateRef.current.isDraggingJoint = false
      document.body.style.cursor = canDrag ? 'grab' : 'pointer'

      if (wasDrag) {
        // Start spring-back animation
        isSpringBack.current = true
        velocityX.current = 0
        velocityZ.current = 0
      } else {
        // Was a click — toggle selection
        setSelectedJoint(isSelected ? null : info.boneName)
      }
    }

    // Capture the pointer so drag events keep flowing even if cursor leaves window
    canvas.setPointerCapture(nativeEvt.pointerId)

    // Attach native DOM listeners for the drag duration
    canvas.addEventListener('pointermove', onDomMove)
    canvas.addEventListener('pointerup', onDomUp)
    canvas.addEventListener('lostpointercapture', onDomUp) // safety: release if capture is lost
  }, [bone, canDrag, gl, info, isSelected, sceneStateRef, setIsDraggingJoint, setSelectedJoint])

  useFrame((state, delta) => {
    if (!groupRef.current || !bone) return

    const visible = sceneStateRef.current?.jointMarkersVisible ?? false
    const t = state.clock.elapsedTime

    // ── Spring-back physics ──
    if (isSpringBack.current) {
      const dt = Math.min(delta, 0.05) // cap to prevent explosion on tab-switch

      // X axis spring
      const displaceX = restRotX.current - bone.rotation.x
      velocityX.current += displaceX * SPRING_STIFFNESS * dt
      velocityX.current *= SPRING_DAMPING
      bone.rotation.x += velocityX.current

      // Z axis spring
      const displaceZ = restRotZ.current - bone.rotation.z
      velocityZ.current += displaceZ * SPRING_STIFFNESS * dt
      velocityZ.current *= SPRING_DAMPING
      bone.rotation.z += velocityZ.current

      // Stop when settled
      const totalVelocity = Math.abs(velocityX.current) + Math.abs(velocityZ.current)
      const totalDisplace = Math.abs(displaceX) + Math.abs(displaceZ)
      if (totalVelocity < SPRING_THRESHOLD && totalDisplace < SPRING_THRESHOLD) {
        bone.rotation.x = restRotX.current
        bone.rotation.z = restRotZ.current
        isSpringBack.current = false
      }
    }

    // ── Position: follow the bone's world position ──
    const worldPos = new THREE.Vector3()
    bone.getWorldPosition(worldPos)
    groupRef.current.position.copy(worldPos)

    // ── Visibility ──
    groupRef.current.visible = visible

    // ── Screen projection: send 2D position to store for tooltip ──
    // Skip during drag (tooltip hidden)
    if (isSelected && visible && !isDragging.current) {
      const projected = worldPos.clone().project(camera)
      const canvas = gl.domElement
      const screenX = (projected.x * 0.5 + 0.5) * canvas.clientWidth
      const screenY = (-projected.y * 0.5 + 0.5) * canvas.clientHeight
      setJointScreenPos({ x: screenX, y: screenY })
    }

    // ── Billboard: reticle rings always face camera ──
    if (reticleRef.current) {
      reticleRef.current.quaternion.copy(camera.quaternion)
    }

    // ── Icon animation by type ──
    if (iconRef.current) {
      const phase = bone.id * 0.7 // per-joint phase offset

      switch (info.type) {
        case 'motorized':
          // Slow gear rotation
          iconRef.current.rotation.z = t * 0.5 + phase
          break
        case 'spring':
          // Compress-extend oscillation along Y
          {
            const squeeze = 1 + Math.sin(t * 1.8 + phase) * 0.2
            iconRef.current.scale.set(1, squeeze, 1)
          }
          break
        case 'reference':
          // Gentle tumble rotation on two axes
          iconRef.current.rotation.x = t * 0.3 + phase
          iconRef.current.rotation.y = t * 0.4 + phase
          break
        case 'fixed':
          // Very slow pulse (barely noticeable)
          {
            const p = 1 + Math.sin(t * 1.2 + phase) * 0.08
            iconRef.current.scale.set(p, p, p)
          }
          break
        case 'visual':
          // Slow rotation
          iconRef.current.rotation.z = t * 0.2 + phase
          break
      }
    }

    // ── Scale: base + hover/select/drag boost + gentle pulse ──
    const pulse = 1 + Math.sin(t * 2 + bone.id * 0.5) * 0.08
    const baseScale = isDragging.current ? 0.42 : isSelected ? 0.35 : hovered ? 0.30 : 0.22
    const s = baseScale * pulse
    groupRef.current.scale.set(s, s, s)
  })

  // Active = white on interaction, silver otherwise
  const isActive = hovered || isSelected || isDragging.current
  const renderColor = isActive ? activeColor3 : baseColor

  return (
    <group
      ref={groupRef}
      renderOrder={10}
      onPointerDown={canDrag ? handlePointerDown : undefined}
      onClick={(e) => {
        e.stopPropagation()
        // Draggable joints: click-to-select is handled in the pointerUp logic
        // (only fires if drag distance < threshold). Absorb the R3F click to
        // prevent it from propagating to other joint markers.
        if (canDrag) return
        // Non-draggable joints toggle selection on click
        setSelectedJoint(isSelected ? null : info.boneName)
      }}
      onPointerEnter={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = canDrag ? 'grab' : 'pointer'
      }}
      onPointerLeave={() => {
        setHovered(false)
        if (!isDragging.current) {
          document.body.style.cursor = 'auto'
        }
      }}
    >
      {/* ── Invisible hit sphere — larger for easier drag targeting ──
       *  Must be visible={true} so R3F raycaster detects it.
       *  opacity=0 + depthWrite=false makes it invisible to the eye. */}
      {canDrag && (
        <mesh renderOrder={9}>
          <sphereGeometry args={[2.5, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
        </mesh>
      )}

      {/* ── Icon: type-specific wireframe geometry (rotates with model) ── */}
      <group ref={iconRef}>
        <lineSegments geometry={iconGeo} renderOrder={12}>
          <lineBasicMaterial
            color={renderColor}
            transparent
            opacity={isActive ? 1 : typeOpacity}
            depthTest={false}
            linewidth={1}
          />
        </lineSegments>
      </group>

      {/* ── Tiny core dot — always visible anchor point ── */}
      <mesh renderOrder={13}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial
          color={renderColor}
          transparent
          opacity={isActive ? 1 : typeOpacity * 0.8}
          depthTest={false}
        />
      </mesh>

      {/* ── Reticle rings — billboard toward camera ── */}
      <group ref={reticleRef}>
        {/* Inner ring: always visible (solid, thin) */}
        <lineSegments geometry={innerRing} renderOrder={11}>
          <lineBasicMaterial
            color={renderColor}
            transparent
            opacity={isActive ? 0.85 : typeOpacity * 0.4}
            depthTest={false}
            linewidth={1}
          />
        </lineSegments>

        {/* Middle ring: visible on hover + selected + dragging (dashed) */}
        {(hovered || isSelected || isDragging.current) && (
          <lineSegments geometry={middleRing} renderOrder={11}>
            <lineBasicMaterial
              color={renderColor}
              transparent
              opacity={isSelected || isDragging.current ? 0.6 : 0.35}
              depthTest={false}
              linewidth={1}
            />
          </lineSegments>
        )}

        {/* Outer ring + ticks: visible on selected or dragging */}
        {(isSelected || isDragging.current) && (
          <>
            <lineSegments geometry={outerRing} renderOrder={11}>
              <lineBasicMaterial
                color={renderColor}
                transparent
                opacity={0.4}
                depthTest={false}
                linewidth={1}
              />
            </lineSegments>
            <lineSegments geometry={ticks} renderOrder={11}>
              <lineBasicMaterial
                color={renderColor}
                transparent
                opacity={0.7}
                depthTest={false}
                linewidth={1}
              />
            </lineSegments>
          </>
        )}
      </group>

      {/* ── Soft glow halo (larger, very transparent) ── */}
      <mesh renderOrder={10}>
        <sphereGeometry args={[1.8, 8, 8]} />
        <meshBasicMaterial
          color={renderColor}
          transparent
          opacity={isActive ? 0.12 : typeOpacity * 0.05}
          depthTest={false}
        />
      </mesh>
    </group>
  )
}
