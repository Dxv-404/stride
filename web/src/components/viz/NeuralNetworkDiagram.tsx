/**
 * NeuralNetworkDiagram — SVG node-link diagram for CPG+NN controller.
 *
 * Layout: Input sensors (left) → Hidden layer (middle) → Output motors (right).
 * Edge color by weight sign (positive=accent, negative=dim).
 * Edge thickness = |weight|. Animated pulses flow along edges.
 */

import { useMemo, useState, useEffect, useRef } from 'react'

interface NeuralNetworkDiagramProps {
  /** Genes array — extracts NN weights from positions 38-95 */
  genes: number[]
  /** Accent color for positive weights */
  accentColor?: string
  /** Width of the SVG */
  width?: number
  /** Height of the SVG */
  height?: number
  /** Whether to animate pulses */
  animated?: boolean
}

const INPUT_LABELS = ['hip_L∠', 'hip_R∠', 'hip_Lω', 'hip_Rω', 'torso∠', 'foot_L']
const HIDDEN_COUNT = 4
const OUTPUT_LABELS = ['hip_L', 'hip_R', 'knee_L', 'knee_R', 'shld_L', 'shld_R']

function decodeWeight(gene: number): number {
  return gene * 4 - 2 // [0,1] → [-2, 2]
}

interface NodePos { x: number; y: number; label: string }

export default function NeuralNetworkDiagram({
  genes,
  accentColor = '#F59E0B',
  width = 400,
  height = 300,
  animated = true,
}: NeuralNetworkDiagramProps) {
  const [, setPulseOffset] = useState(0)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!animated) return
    let running = true
    const tick = () => {
      if (!running) return
      setPulseOffset(prev => (prev + 0.02) % 1)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [animated])

  const { inputNodes, hiddenNodes, outputNodes, w1, b1, w2, b2 } = useMemo(() => {
    const padX = 60
    const padY = 30
    const layerWidth = (width - padX * 2) / 2

    // Input layer (6 nodes)
    const inputNodes: NodePos[] = INPUT_LABELS.map((label, i) => ({
      x: padX,
      y: padY + (i / (INPUT_LABELS.length - 1)) * (height - padY * 2),
      label,
    }))

    // Hidden layer (4 nodes)
    const hiddenNodes: NodePos[] = Array.from({ length: HIDDEN_COUNT }, (_, i) => ({
      x: padX + layerWidth,
      y: padY + 30 + (i / (HIDDEN_COUNT - 1)) * (height - padY * 2 - 60),
      label: `h${i}`,
    }))

    // Output layer (6 nodes)
    const outputNodes: NodePos[] = OUTPUT_LABELS.map((label, i) => ({
      x: padX + layerWidth * 2,
      y: padY + (i / (OUTPUT_LABELS.length - 1)) * (height - padY * 2),
      label,
    }))

    // Decode weights from genes 38-95
    // W1: 4 hidden × 6 input = 24 weights (genes 38-61)
    const w1: number[][] = []
    for (let h = 0; h < HIDDEN_COUNT; h++) {
      const row: number[] = []
      for (let inp = 0; inp < 6; inp++) {
        const geneIdx = 38 + h * 6 + inp
        row.push(genes[geneIdx] !== undefined ? decodeWeight(genes[geneIdx]) : 0)
      }
      w1.push(row)
    }

    // b1: 4 biases (genes 62-65)
    const b1 = Array.from({ length: HIDDEN_COUNT }, (_, i) =>
      genes[62 + i] !== undefined ? decodeWeight(genes[62 + i]) : 0
    )

    // W2: 6 output × 4 hidden = 24 weights (genes 66-89)
    const w2: number[][] = []
    for (let out = 0; out < 6; out++) {
      const row: number[] = []
      for (let h = 0; h < HIDDEN_COUNT; h++) {
        const geneIdx = 66 + out * HIDDEN_COUNT + h
        row.push(genes[geneIdx] !== undefined ? decodeWeight(genes[geneIdx]) : 0)
      }
      w2.push(row)
    }

    // b2: 6 biases (genes 90-95)
    const b2 = Array.from({ length: 6 }, (_, i) =>
      genes[90 + i] !== undefined ? decodeWeight(genes[90 + i]) : 0
    )

    return { inputNodes, hiddenNodes, outputNodes, w1, b1, w2, b2 }
  }, [genes, width, height])

  const maxWeight = useMemo(() => {
    let mx = 0.01
    for (const row of w1) for (const w of row) mx = Math.max(mx, Math.abs(w))
    for (const row of w2) for (const w of row) mx = Math.max(mx, Math.abs(w))
    return mx
  }, [w1, w2])

  return (
    <svg width={width} height={height} className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <filter id="nn-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* W1 edges: input → hidden */}
      {hiddenNodes.map((hn, h) =>
        inputNodes.map((inp, i) => {
          const w = w1[h]?.[i] ?? 0
          const absW = Math.abs(w)
          const thickness = 0.5 + (absW / maxWeight) * 3
          const color = w > 0 ? accentColor : '#6B7280'
          const opacity = 0.15 + (absW / maxWeight) * 0.6

          return (
            <g key={`w1-${h}-${i}`}>
              <line
                x1={inp.x} y1={inp.y} x2={hn.x} y2={hn.y}
                stroke={color}
                strokeWidth={thickness}
                opacity={opacity}
              />
              {animated && absW > maxWeight * 0.3 && (
                <circle r={2} fill={color} opacity={0.8}>
                  <animateMotion
                    dur={`${2 - absW / maxWeight}s`}
                    repeatCount="indefinite"
                    path={`M${inp.x},${inp.y} L${hn.x},${hn.y}`}
                  />
                </circle>
              )}
            </g>
          )
        })
      )}

      {/* W2 edges: hidden → output */}
      {outputNodes.map((out, o) =>
        hiddenNodes.map((hn, h) => {
          const w = w2[o]?.[h] ?? 0
          const absW = Math.abs(w)
          const thickness = 0.5 + (absW / maxWeight) * 3
          const color = w > 0 ? accentColor : '#6B7280'
          const opacity = 0.15 + (absW / maxWeight) * 0.6

          return (
            <g key={`w2-${o}-${h}`}>
              <line
                x1={hn.x} y1={hn.y} x2={out.x} y2={out.y}
                stroke={color}
                strokeWidth={thickness}
                opacity={opacity}
              />
              {animated && absW > maxWeight * 0.3 && (
                <circle r={2} fill={color} opacity={0.8}>
                  <animateMotion
                    dur={`${2 - absW / maxWeight}s`}
                    repeatCount="indefinite"
                    path={`M${hn.x},${hn.y} L${out.x},${out.y}`}
                  />
                </circle>
              )}
            </g>
          )
        })
      )}

      {/* Input nodes */}
      {inputNodes.map((n, i) => (
        <g key={`in-${i}`}>
          <circle cx={n.x} cy={n.y} r={10} fill="#1a1a2e" stroke="#444" strokeWidth={1.5} />
          <text x={n.x - 16} y={n.y + 3} textAnchor="end" fontSize={8} fill="#888" fontFamily="monospace">
            {n.label}
          </text>
        </g>
      ))}

      {/* Hidden nodes */}
      {hiddenNodes.map((n, i) => {
        const bias = b1[i] ?? 0
        const biasNorm = Math.abs(bias) / 2
        return (
          <g key={`h-${i}`} filter="url(#nn-glow)">
            <circle
              cx={n.x} cy={n.y} r={12}
              fill={`rgba(${bias > 0 ? '245,158,11' : '107,114,128'},${0.2 + biasNorm * 0.5})`}
              stroke={bias > 0 ? accentColor : '#555'}
              strokeWidth={1.5}
            />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={7} fill="#aaa" fontFamily="monospace">
              {n.label}
            </text>
          </g>
        )
      })}

      {/* Output nodes */}
      {outputNodes.map((n, i) => {
        const bias = b2[i] ?? 0
        const biasNorm = Math.abs(bias) / 2
        return (
          <g key={`out-${i}`}>
            <circle
              cx={n.x} cy={n.y} r={10}
              fill={`rgba(${bias > 0 ? '245,158,11' : '107,114,128'},${0.2 + biasNorm * 0.4})`}
              stroke={bias > 0 ? accentColor : '#555'}
              strokeWidth={1.5}
            />
            <text x={n.x + 16} y={n.y + 3} textAnchor="start" fontSize={8} fill="#888" fontFamily="monospace">
              {n.label}
            </text>
          </g>
        )
      })}

      {/* Layer labels */}
      <text x={inputNodes[0].x} y={12} textAnchor="middle" fontSize={9} fill="#555" fontFamily="monospace">
        SENSORS
      </text>
      <text x={hiddenNodes[0].x} y={12} textAnchor="middle" fontSize={9} fill="#555" fontFamily="monospace">
        HIDDEN
      </text>
      <text x={outputNodes[0].x} y={12} textAnchor="middle" fontSize={9} fill="#555" fontFamily="monospace">
        MOTORS
      </text>
    </svg>
  )
}
