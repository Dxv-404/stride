import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VisualMode } from '@/components/simulation/VisualModes'

interface UIState {
  // Layout
  sidebarCollapsed: boolean
  configPanelOpen: boolean

  // Panel visibility
  inspectorOpen: boolean
  oscilloscopeOpen: boolean
  diversityMapOpen: boolean
  mutationMapOpen: boolean
  shortcutsModalOpen: boolean

  // Mutation map mode
  mutationMapMode: 'helix' | 'heatmap'

  // Visual mode for LiveCanvas
  visualMode: VisualMode

  // Selected creature
  selectedCreatureId: number | null
  compareCreatureId: number | null

  // Learn page
  interactiveMode: boolean

  // Playground tab
  playgroundTab: 'sliders' | 'timeline' | 'presets' | 'diff' | 'constraints' | 'helix'

  // Audio
  audioEnabled: boolean
  audioVolume: number

  // Actions
  toggleSidebar: () => void
  toggleConfigPanel: () => void
  setConfigPanelOpen: (open: boolean) => void
  toggleInspector: () => void
  toggleOscilloscope: () => void
  toggleDiversityMap: () => void
  toggleMutationMap: () => void
  toggleShortcutsModal: () => void
  setMutationMapMode: (mode: 'helix' | 'heatmap') => void
  setVisualMode: (mode: VisualMode) => void
  cycleVisualMode: () => void
  selectCreature: (id: number | null) => void
  setCompareCreature: (id: number | null) => void
  toggleInteractiveMode: () => void
  setPlaygroundTab: (tab: UIState['playgroundTab']) => void
  toggleAudio: () => void
  setAudioVolume: (vol: number) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      configPanelOpen: false,

      inspectorOpen: false,
      oscilloscopeOpen: false,
      diversityMapOpen: false,
      mutationMapOpen: false,
      shortcutsModalOpen: false,
      mutationMapMode: 'helix' as const,
      visualMode: 'normal' as VisualMode,
      selectedCreatureId: null,
      compareCreatureId: null,
      interactiveMode: true,
      playgroundTab: 'sliders' as const,
      audioEnabled: false,
      audioVolume: 0.5,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleConfigPanel: () => set((s) => ({ configPanelOpen: !s.configPanelOpen })),
      setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      toggleOscilloscope: () => set((s) => ({ oscilloscopeOpen: !s.oscilloscopeOpen })),
      toggleDiversityMap: () => set((s) => ({ diversityMapOpen: !s.diversityMapOpen })),
      toggleMutationMap: () => set((s) => ({ mutationMapOpen: !s.mutationMapOpen })),
      toggleShortcutsModal: () => set((s) => ({ shortcutsModalOpen: !s.shortcutsModalOpen })),
      setMutationMapMode: (mode) => set({ mutationMapMode: mode }),
      setVisualMode: (mode) => set({ visualMode: mode }),
      cycleVisualMode: () => set((s) => {
        const modes: VisualMode[] = ['normal', 'xray', 'heatmap', 'blueprint', 'inkwash']
        const idx = modes.indexOf(s.visualMode)
        return { visualMode: modes[(idx + 1) % modes.length] }
      }),
      selectCreature: (id) => set({ selectedCreatureId: id }),
      setCompareCreature: (id) => set({ compareCreatureId: id }),
      toggleInteractiveMode: () => set((s) => ({ interactiveMode: !s.interactiveMode })),
      setPlaygroundTab: (tab) => set({ playgroundTab: tab }),
      toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
      setAudioVolume: (vol) => set({ audioVolume: Math.max(0, Math.min(1, vol)) }),
    }),
    {
      name: 'stride-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
