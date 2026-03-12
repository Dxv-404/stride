/**
 * ChromosomeHelix — Three.js double-helix visualization of a chromosome.
 *
 * Each gene = one "rung" on the helix. Color intensity = gene value.
 * Slowly rotates. Click a rung to highlight that gene.
 * Hover any rung or end sphere to see gene details.
 */

import { useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from './R3FHelpers'
import * as THREE from 'three'

interface ChromosomeHelixProps {
  genes: number[]
  geneLabels?: string[]
  accentColor?: string
  onGeneClick?: (index: number) => void
}

interface TooltipState {
  x: number
  y: number
  geneName: string
  geneValue: number
  geneIndex: number
  totalGenes: number
}

const HELIX_RADIUS = 0.8
const HELIX_RISE = 0.25 // vertical rise per gene
const TURNS_PER_GENE = 0.18 // how tight the helix winds

function HelixStrand({
  genes,
  accentColor,
  offset,
}: {
  genes: number[]
  accentColor: string
  offset: number // 0 or pi for the two strands
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= genes.length; i++) {
      const angle = i * TURNS_PER_GENE * Math.PI * 2 + offset
      const x = Math.cos(angle) * HELIX_RADIUS
      const z = Math.sin(angle) * HELIX_RADIUS
      const y = i * HELIX_RISE - (genes.length * HELIX_RISE) / 2
      pts.push(new THREE.Vector3(x, y, z))
    }
    return pts
  }, [genes.length, offset])

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points])

  return (
    <mesh>
      <tubeGeometry args={[curve, genes.length * 4, 0.03, 8, false]} />
      <meshStandardMaterial color={accentColor} opacity={0.4} transparent />
    </mesh>
  )
}

function GeneRung({
  index,
  gene,
  totalGenes,
  accentColor,
  selected,
  onClick,
  onHover,
  onLeave,
}: {
  index: number
  gene: number
  totalGenes: number
  accentColor: string
  selected: boolean
  onClick: () => void
  onHover: (e: ThreeEvent<PointerEvent>) => void
  onLeave: () => void
}) {
  const rungRef = useRef<THREE.Mesh>(null)
  const sphere1Ref = useRef<THREE.Mesh>(null)
  const sphere2Ref = useRef<THREE.Mesh>(null)
  const angle = index * TURNS_PER_GENE * Math.PI * 2
  const y = index * HELIX_RISE - (totalGenes * HELIX_RISE) / 2

  const pos1 = new THREE.Vector3(
    Math.cos(angle) * HELIX_RADIUS,
    y,
    Math.sin(angle) * HELIX_RADIUS
  )
  const pos2 = new THREE.Vector3(
    Math.cos(angle + Math.PI) * HELIX_RADIUS,
    y,
    Math.sin(angle + Math.PI) * HELIX_RADIUS
  )

  const midpoint = pos1.clone().add(pos2).multiplyScalar(0.5)
  const direction = pos2.clone().sub(pos1)
  const length = direction.length()

  const color = useMemo(() => {
    const base = new THREE.Color(accentColor)
    const intensity = 0.2 + gene * 0.8
    return base.multiplyScalar(intensity)
  }, [gene, accentColor])

  const handlePointerOver = (ref: React.RefObject<THREE.Mesh | null>) => {
    return (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (ref.current) (ref.current as any).scale.set(1.3, 1.3, 1.3)
      onHover(e)
    }
  }

  const handlePointerOut = (ref: React.RefObject<THREE.Mesh | null>) => {
    return () => {
      if (ref.current) (ref.current as any).scale.set(1, 1, 1)
      onLeave()
    }
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }

  return (
    <group>
      {/* Rung cylinder */}
      <mesh
        ref={rungRef}
        position={midpoint}
        onClick={handleClick}
        onPointerOver={handlePointerOver(rungRef)}
        onPointerOut={handlePointerOut(rungRef)}
      >
        <cylinderGeometry args={[selected ? 0.04 : 0.025, selected ? 0.04 : 0.025, length, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? accentColor : '#000'}
          emissiveIntensity={selected ? 0.5 : 0}
        />
      </mesh>

      {/* End sphere 1 */}
      <mesh
        ref={sphere1Ref}
        position={pos1}
        onClick={handleClick}
        onPointerOver={handlePointerOver(sphere1Ref)}
        onPointerOut={handlePointerOut(sphere1Ref)}
      >
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* End sphere 2 */}
      <mesh
        ref={sphere2Ref}
        position={pos2}
        onClick={handleClick}
        onPointerOver={handlePointerOver(sphere2Ref)}
        onPointerOut={handlePointerOut(sphere2Ref)}
      >
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

function HelixGroup({
  genes,
  geneLabels: _geneLabels,
  accentColor,
  onGeneClick,
  onGeneHover,
  onGeneLeave,
}: {
  genes: number[]
  geneLabels: string[]
  accentColor: string
  onGeneClick: (i: number) => void
  onGeneHover: (e: ThreeEvent<PointerEvent>, index: number) => void
  onGeneLeave: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const [selectedGene, setSelectedGene] = useState(-1)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })

  const handleClick = (i: number) => {
    setSelectedGene(i === selectedGene ? -1 : i)
    onGeneClick(i)
  }

  return (
    <group ref={groupRef}>
      {/* Two backbone strands */}
      <HelixStrand
        genes={genes}
        accentColor={accentColor}
        offset={0}
      />
      <HelixStrand
        genes={genes}
        accentColor={accentColor}
        offset={Math.PI}
      />

      {/* Gene rungs */}
      {genes.map((gene, i) => (
        <GeneRung
          key={i}
          index={i}
          gene={gene}
          totalGenes={genes.length}
          accentColor={accentColor}
          selected={i === selectedGene}
          onClick={() => handleClick(i)}
          onHover={(e) => onGeneHover(e, i)}
          onLeave={onGeneLeave}
        />
      ))}
    </group>
  )
}

export default function ChromosomeHelix({
  genes,
  geneLabels,
  accentColor = '#F59E0B',
  onGeneClick,
}: ChromosomeHelixProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const labels = useMemo(() => {
    if (geneLabels && geneLabels.length >= genes.length) return geneLabels
    return genes.map((_, i) => `Gene ${i}`)
  }, [genes, geneLabels])

  const cameraY = (genes.length * HELIX_RISE) / 4

  const handleGeneHover = useCallback((e: ThreeEvent<PointerEvent>, index: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setTooltip({
      x: (e.nativeEvent as PointerEvent).clientX - rect.left,
      y: (e.nativeEvent as PointerEvent).clientY - rect.top,
      geneName: labels[index] ?? `Gene ${index}`,
      geneValue: genes[index] ?? 0,
      geneIndex: index,
      totalGenes: genes.length,
    })
  }, [labels, genes])

  const handleGeneLeave = useCallback(() => setTooltip(null), [])

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ minHeight: 300 }}>
      <Canvas camera={{ position: [3, cameraY, 3], fov: 40 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />
        <pointLight position={[0, 3, 0]} intensity={0.3} />

        <HelixGroup
          genes={genes}
          geneLabels={labels}
          accentColor={accentColor}
          onGeneClick={onGeneClick ?? (() => {})}
          onGeneHover={handleGeneHover}
          onGeneLeave={handleGeneLeave}
        />

        <OrbitControls
          enablePan={true}
          minDistance={2}
          maxDistance={8}
          resetKey={genes}
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
            {tooltip.geneName}
          </p>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-text-secondary">
              Value{' '}<span className="text-text-primary ml-2">{tooltip.geneValue.toFixed(3)}</span>
            </p>
            <p className="font-mono text-[10px] text-text-secondary">
              Gene{' '}<span className="text-text-primary ml-2">{tooltip.geneIndex} of {tooltip.totalGenes}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
