/**
 * FamilyTree — SVG tree diagram showing parent->child relationships.
 *
 * Nodes colored by fitness. Shows how solutions descend through generations.
 * Each row = one generation, nodes connected by breeding lines.
 * Hover a node to see creature details.
 */

import { useMemo, useRef, useState } from 'react'

interface TreeNode {
  id: number
  fitness: number
  parentIds: [number, number] | null
  generation: number
}

interface FamilyTreeProps {
  /** Creatures across generations (best few per gen) */
  creatures: TreeNode[]
  /** Max generations to show */
  maxGens?: number
  /** Accent color */
  accentColor?: string
  width?: number
  height?: number
}

interface TooltipState {
  x: number
  y: number
  id: number
  fitness: number
  generation: number
  isBest: boolean
}

export default function FamilyTree({
  creatures,
  maxGens = 20,
  accentColor = '#F59E0B',
  width = 600,
  height = 400,
}: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { gens, maxFitness } = useMemo(() => {
    const byGen = new Map<number, TreeNode[]>()
    let maxFit = 0
    const nodeMap = new Map<number, TreeNode>()

    for (const c of creatures) {
      const gen = c.generation
      if (!byGen.has(gen)) byGen.set(gen, [])
      byGen.get(gen)!.push(c)
      maxFit = Math.max(maxFit, c.fitness)
      nodeMap.set(c.id, c)
    }

    // Sort each gen by fitness
    for (const [, list] of byGen) list.sort((a, b) => b.fitness - a.fitness)

    // Only keep last maxGens
    const allGens = [...byGen.keys()].sort((a, b) => a - b)
    const trimmed = allGens.slice(-maxGens)
    const gens = trimmed.map(g => ({ gen: g, nodes: byGen.get(g)! }))

    return { gens, maxFitness: maxFit || 1 }
  }, [creatures, maxGens])

  if (gens.length === 0) {
    return (
      <div className="text-center text-text-dim text-xs py-8">
        No lineage data available yet. Run evolution to build the family tree.
      </div>
    )
  }

  const padX = 30
  const padY = 30
  const rowHeight = (height - padY * 2) / Math.max(1, gens.length - 1)
  const getNodePos = (genIdx: number, nodeIdx: number, nodesInRow: number) => {
    const x = padX + ((nodeIdx + 1) / (nodesInRow + 1)) * (width - padX * 2)
    const y = padY + genIdx * rowHeight
    return { x, y }
  }

  // Build position lookup
  const posMap = new Map<number, { x: number; y: number }>()
  gens.forEach((g, gi) => {
    g.nodes.forEach((n, ni) => {
      posMap.set(n.id, getNodePos(gi, ni, g.nodes.length))
    })
  })

  const handleNodeEnter = (e: React.MouseEvent, node: TreeNode, isBestInGen: boolean) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      id: node.id,
      fitness: node.fitness,
      generation: node.generation,
      isBest: isBestInGen,
    })
  }

  const handleNodeLeave = () => setTooltip(null)

  return (
    <div ref={containerRef} className="relative">
      <svg width={width} height={height} className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
        {/* Connection lines */}
        {gens.map((g) =>
          g.nodes.map(node => {
            if (!node.parentIds) return null
            const childPos = posMap.get(node.id)
            if (!childPos) return null

            return node.parentIds.map((pid, pi) => {
              const parentPos = posMap.get(pid)
              if (!parentPos) return null
              return (
                <line
                  key={`${node.id}-${pid}-${pi}`}
                  x1={parentPos.x} y1={parentPos.y}
                  x2={childPos.x} y2={childPos.y}
                  stroke={accentColor}
                  strokeWidth={0.5}
                  opacity={0.2}
                />
              )
            })
          })
        )}

        {/* Generation labels */}
        {gens.map((g, gi) => (
          <text
            key={`gen-${g.gen}`}
            x={8} y={padY + gi * rowHeight + 3}
            fontSize={7} fill="#555" fontFamily="monospace"
          >
            G{g.gen}
          </text>
        ))}

        {/* Nodes */}
        {gens.map((g, gi) =>
          g.nodes.map((node, ni) => {
            const pos = getNodePos(gi, ni, g.nodes.length)
            const fitNorm = node.fitness / maxFitness
            const radius = 2 + fitNorm * 4
            const isBest = ni === 0

            return (
              <g key={node.id}>
                <circle
                  cx={pos.x} cy={pos.y} r={radius}
                  fill={accentColor}
                  opacity={0.3 + fitNorm * 0.7}
                  className="cursor-pointer"
                  onMouseEnter={e => handleNodeEnter(e, node, isBest)}
                  onMouseLeave={handleNodeLeave}
                />
                {/* Highlight best per gen */}
                {isBest && (
                  <circle
                    cx={pos.x} cy={pos.y} r={radius + 2}
                    fill="none" stroke={accentColor} strokeWidth={0.5} opacity={0.5}
                  />
                )}
              </g>
            )
          })
        )}
      </svg>

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
            Creature #{tooltip.id}
          </p>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-text-secondary">
              Fitness{' '}<span className="text-text-primary ml-2">{tooltip.fitness.toFixed(1)}</span>
            </p>
            <p className="font-mono text-[10px] text-text-secondary">
              Gen{' '}<span className="text-text-primary ml-2">{tooltip.generation}</span>
            </p>
          </div>
          {tooltip.isBest && (
            <p className="font-mono text-[9px] text-accent mt-1.5 tracking-wider uppercase">Best in generation</p>
          )}
        </div>
      )}
    </div>
  )
}
