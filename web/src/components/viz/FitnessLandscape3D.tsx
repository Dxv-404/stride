/**
 * FitnessLandscape3D — Three.js surface plot of fitness across gene space.
 *
 * X = gene dimension 1, Y = gene dimension 2, Z = fitness.
 * Uses epistasis data (gene interaction matrix) to create the surface.
 * Orbit controls for rotation/zoom. Monochromatic color gradient.
 * Hover the surface to see gene values and fitness at that point.
 */

import { useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Text } from './R3FHelpers'
import * as THREE from 'three'

interface FitnessLandscape3DProps {
  /** 2D grid of fitness values: grid[row][col] = fitness */
  grid: number[][]
  /** Labels for X and Y axes */
  xLabel?: string
  yLabel?: string
  /** Accent color for the surface */
  accentColor?: string
}

interface TooltipState {
  x: number
  y: number
  geneA: number
  geneB: number
  fitness: number
}

const GRID_RES = 32

function generateDefaultGrid(): number[][] {
  // Generate a sample landscape with peaks and valleys
  const grid: number[][] = []
  for (let i = 0; i < GRID_RES; i++) {
    const row: number[] = []
    for (let j = 0; j < GRID_RES; j++) {
      const x = (i / GRID_RES) * 4 - 2
      const y = (j / GRID_RES) * 4 - 2
      // Two peaks + a ridge
      const peak1 = Math.exp(-((x - 0.5) ** 2 + (y - 0.5) ** 2) * 2) * 80
      const peak2 = Math.exp(-((x + 0.8) ** 2 + (y + 0.3) ** 2) * 3) * 60
      const ridge = Math.exp(-((x + y) ** 2) * 0.5) * 30
      const noise = Math.sin(x * 5) * Math.cos(y * 5) * 5
      row.push(peak1 + peak2 + ridge + noise + 10)
    }
    grid.push(row)
  }
  return grid
}

function Surface({
  grid,
  accentColor,
  onHover,
  onLeave,
}: {
  grid: number[][]
  accentColor: string
  onHover: (e: ThreeEvent<PointerEvent>, grid: number[][]) => void
  onLeave: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { geometry } = useMemo(() => {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    if (rows < 2 || cols < 2) {
      return { geometry: new THREE.PlaneGeometry(1, 1), maxZ: 1, minZ: 0 }
    }

    const geo = new THREE.PlaneGeometry(4, 4, cols - 1, rows - 1)
    const positions = geo.attributes.position
    let mn = Infinity, mx = -Infinity

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = i * cols + j
        const z = grid[i][j] ?? 0
        mn = Math.min(mn, z)
        mx = Math.max(mx, z)
        positions.setZ(idx, z * 0.03) // Scale height
      }
    }

    // CRITICAL: Tell Three.js the buffer was modified so GPU re-uploads it
    positions.needsUpdate = true
    geo.computeVertexNormals()

    // Apply vertex colors
    const colors = new Float32Array(positions.count * 3)
    const range = mx - mn || 1
    const base = new THREE.Color(accentColor)

    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i)
      const t = (z / 0.03 - mn) / range
      const color = new THREE.Color().copy(base)
      color.multiplyScalar(0.2 + t * 0.8)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    return { geometry: geo, maxZ: mx, minZ: mn }
  }, [grid, accentColor])

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.05
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={e => { e.stopPropagation(); onHover(e, grid) }}
      onPointerLeave={onLeave}
    >
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} wireframe={false} />
    </mesh>
  )
}

function WireframeSurface({ grid, accentColor }: { grid: number[][]; accentColor: string }) {
  const { geometry } = useMemo(() => {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    if (rows < 2 || cols < 2) {
      return { geometry: new THREE.PlaneGeometry(1, 1) }
    }

    const geo = new THREE.PlaneGeometry(4, 4, cols - 1, rows - 1)
    const positions = geo.attributes.position

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = i * cols + j
        positions.setZ(idx, (grid[i][j] ?? 0) * 0.03)
      }
    }

    // CRITICAL: Tell Three.js the buffer was modified
    positions.needsUpdate = true
    geo.computeVertexNormals()
    return { geometry: geo }
  }, [grid])

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
      <meshBasicMaterial color={accentColor} wireframe opacity={0.15} transparent />
    </mesh>
  )
}

function BestMarker({ grid, accentColor }: { grid: number[][]; accentColor: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const { position } = useMemo(() => {
    let maxZ = -Infinity
    let bestI = 0, bestJ = 0
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < (grid[0]?.length ?? 0); j++) {
        if ((grid[i][j] ?? 0) > maxZ) {
          maxZ = grid[i][j]
          bestI = i
          bestJ = j
        }
      }
    }
    const cols = grid[0]?.length ?? GRID_RES
    const rows = grid.length
    const x = (bestJ / (cols - 1)) * 4 - 2
    const z = (bestI / (rows - 1)) * 4 - 2
    const y = maxZ * 0.03 + 0.15
    return { position: new THREE.Vector3(x, y, -z) }
  }, [grid])

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 2) * 0.08
    }
  })

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
    </mesh>
  )
}

function AxisLabels({ xLabel, yLabel }: { xLabel: string; yLabel: string }) {
  return (
    <>
      <Text position={[0, -0.3, 2.5]} fontSize={0.15} color="#888" anchorX="center">
        {xLabel}
      </Text>
      <Text position={[-2.5, -0.3, 0]} fontSize={0.15} color="#888" anchorX="center" rotation={[0, Math.PI / 2, 0]}>
        {yLabel}
      </Text>
    </>
  )
}

export default function FitnessLandscape3D({
  grid,
  xLabel = 'Gene 1',
  yLabel = 'Gene 2',
  accentColor = '#F59E0B',
}: FitnessLandscape3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const displayGrid = useMemo(() => {
    if (grid && grid.length >= 2 && (grid[0]?.length ?? 0) >= 2) return grid
    return generateDefaultGrid()
  }, [grid])

  const handleHover = useCallback((e: ThreeEvent<PointerEvent>, g: number[][]) => {
    const container = containerRef.current
    if (!container) return

    // Map 3D intersection point back to grid coordinates
    const point = e.point
    const rows = g.length
    const cols = g[0]?.length ?? 0
    // The plane spans from -2 to +2, map to 0..1
    const normX = (point.x + 2) / 4
    const normZ = (-point.z + 2) / 4

    const col = Math.round(normX * (cols - 1))
    const row = Math.round(normZ * (rows - 1))
    const clampedRow = Math.max(0, Math.min(rows - 1, row))
    const clampedCol = Math.max(0, Math.min(cols - 1, col))
    const fitness = g[clampedRow]?.[clampedCol] ?? 0

    const rect = container.getBoundingClientRect()
    setTooltip({
      x: (e.nativeEvent as PointerEvent).clientX - rect.left,
      y: (e.nativeEvent as PointerEvent).clientY - rect.top,
      geneA: normX,
      geneB: normZ,
      fitness,
    })
  }, [])

  const handleLeave = useCallback(() => setTooltip(null), [])

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ minHeight: 300 }}>
      <Canvas camera={{ position: [4, 3, 4], fov: 45 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />
        <directionalLight position={[-3, 5, -3]} intensity={0.3} />

        <Surface
          grid={displayGrid}
          accentColor={accentColor}
          onHover={handleHover}
          onLeave={handleLeave}
        />
        <WireframeSurface grid={displayGrid} accentColor={accentColor} />
        <BestMarker grid={displayGrid} accentColor={accentColor} />
        <AxisLabels xLabel={xLabel} yLabel={yLabel} />

        {/* Ground grid */}
        <gridHelper args={[4, 16, '#333', '#222']} position={[0, -0.1, 0]} />

        <OrbitControls
          enablePan={true}
          minDistance={2}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.5}
          resetKey={displayGrid}
        />
      </Canvas>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 border border-border bg-bg-surface px-3 py-2.5 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1.5">
            Fitness Point
          </p>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-text-secondary">
              {xLabel}{' '}<span className="text-text-primary ml-2">{tooltip.geneA.toFixed(2)}</span>
            </p>
            <p className="font-mono text-[10px] text-text-secondary">
              {yLabel}{' '}<span className="text-text-primary ml-2">{tooltip.geneB.toFixed(2)}</span>
            </p>
            <p className="font-mono text-[10px] text-text-secondary">
              Fitness{' '}<span className="text-text-primary ml-2">{tooltip.fitness.toFixed(1)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Build a fitness grid from epistasis matrix data */
export function buildGridFromEpistasis(matrix: number[][], geneIdxA: number, geneIdxB: number): number[][] {
  const size = GRID_RES
  const grid: number[][] = []
  const baseVal = matrix[geneIdxA]?.[geneIdxB] ?? 0

  for (let i = 0; i < size; i++) {
    const row: number[] = []
    for (let j = 0; j < size; j++) {
      const x = i / (size - 1)
      const y = j / (size - 1)
      // Combine the epistasis interaction with synthetic landscape
      const interaction = baseVal * Math.sin(x * Math.PI) * Math.sin(y * Math.PI) * 100
      const base = 50 * (1 - (x - 0.5) ** 2 - (y - 0.5) ** 2)
      row.push(Math.max(0, base + interaction))
    }
    grid.push(row)
  }

  return grid
}
