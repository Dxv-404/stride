import { create } from 'zustand'
import {
  DEFAULT_POPULATION_SIZE,
  DEFAULT_MAX_GENERATIONS,
  DEFAULT_MUTATION_RATE,
  DEFAULT_CROSSOVER_RATE,
  DEFAULT_ELITISM_RATE,
} from '@/engine/config.ts'

export type SelectionMethod = 'tournament' | 'roulette' | 'rank'
export type TerrainType = 'flat' | 'hill' | 'mixed' | 'custom'
export type EncodingType = 'direct' | 'indirect'
export type PlaybackSpeed = 1 | 2 | 5 | 10 | 'max'
export type SimStatus = 'idle' | 'running' | 'paused' | 'completed'

export interface SimParams {
  populationSize: number
  mutationRate: number
  crossoverRate: number
  elitismRate: number
  selectionMethod: SelectionMethod
  terrainType: TerrainType
  encoding: EncodingType
  maxGenerations: number
}

export interface SimStats {
  generation: number
  bestFitness: number
  avgFitness: number
  worstFitness: number
  diversity: number
  fitnessHistory: { gen: number; best: number; avg: number }[]
}

interface SimulationState {
  // Status
  status: SimStatus
  speed: PlaybackSpeed

  // Parameters
  params: SimParams

  // Live stats
  stats: SimStats

  // Playback controls
  autoPauseBetweenGens: boolean
  scrubberGeneration: number | null

  // Actions
  setStatus: (status: SimStatus) => void
  setSpeed: (speed: PlaybackSpeed) => void
  setParam: <K extends keyof SimParams>(key: K, value: SimParams[K]) => void
  setParams: (params: Partial<SimParams>) => void
  updateStats: (stats: Partial<SimStats>) => void
  setAutoPauseBetweenGens: (value: boolean) => void
  setScrubberGeneration: (gen: number | null) => void
  reset: () => void
}

const DEFAULT_PARAMS: SimParams = {
  populationSize: DEFAULT_POPULATION_SIZE,
  mutationRate: DEFAULT_MUTATION_RATE,
  crossoverRate: DEFAULT_CROSSOVER_RATE,
  elitismRate: DEFAULT_ELITISM_RATE,
  selectionMethod: 'tournament',
  terrainType: 'flat',
  encoding: 'direct',
  maxGenerations: DEFAULT_MAX_GENERATIONS,
}

const DEFAULT_STATS: SimStats = {
  generation: 0,
  bestFitness: 0,
  avgFitness: 0,
  worstFitness: 0,
  diversity: 1,
  fitnessHistory: [],
}

export const useSimulationStore = create<SimulationState>((set) => ({
  status: 'idle',
  speed: 1,
  params: { ...DEFAULT_PARAMS },
  stats: { ...DEFAULT_STATS },
  autoPauseBetweenGens: false,
  scrubberGeneration: null,

  setStatus: (status) => set({ status }),
  setSpeed: (speed) => set({ speed }),
  setParam: (key, value) =>
    set((state) => ({ params: { ...state.params, [key]: value } })),
  setParams: (params) =>
    set((state) => ({ params: { ...state.params, ...params } })),
  updateStats: (stats) =>
    set((state) => ({ stats: { ...state.stats, ...stats } })),
  setAutoPauseBetweenGens: (value) => set({ autoPauseBetweenGens: value }),
  setScrubberGeneration: (gen) => set({ scrubberGeneration: gen }),
  reset: () =>
    set({ status: 'idle', stats: { ...DEFAULT_STATS }, scrubberGeneration: null }),
}))
