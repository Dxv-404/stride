import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HallOfFameEntry {
  id: string
  fitness: number
  genes: number[]
  terrainType: string
  params: Record<string, unknown>
  date: string
  label?: string
}

interface HallOfFameState {
  entries: HallOfFameEntry[]
  addEntry: (entry: Omit<HallOfFameEntry, 'id' | 'date'>) => void
  removeEntry: (id: string) => void
  clearAll: () => void
}

export const useHallOfFameStore = create<HallOfFameState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry) =>
        set((state) => {
          const newEntry: HallOfFameEntry = {
            ...entry,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
          }
          // Keep top 20, sorted by fitness descending
          const updated = [...state.entries, newEntry]
            .sort((a, b) => b.fitness - a.fitness)
            .slice(0, 20)
          return { entries: updated }
        }),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      clearAll: () => set({ entries: [] }),
    }),
    { name: 'stride-hall-of-fame' }
  )
)
