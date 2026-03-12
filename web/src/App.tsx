import { Routes, Route } from 'react-router-dom'
import Layout from './components/shared/Layout'
import KeyboardShortcuts from './components/shared/KeyboardShortcuts'
import ShortcutsModal from './components/shared/ShortcutsModal'
import Landing from './pages/Landing'
import Lab from './pages/Lab'
import Compare from './pages/Compare'
import PushTest from './pages/PushTest'
import Playground from './pages/Playground'
import TerrainEditorPage from './pages/TerrainEditorPage'
import Results from './pages/Results'
import Learn from './pages/Learn'
import HallOfFamePage from './pages/HallOfFamePage'

function App() {
  return (
    <>
      <div className="grain-overlay" />
      <KeyboardShortcuts />
      <ShortcutsModal />
      <Routes>
        {/* Landing page renders without sidebar/header */}
        <Route path="/" element={<Landing />} />

        {/* All other pages use the Layout shell (sidebar + header) */}
        <Route element={<Layout />}>
          <Route path="/lab" element={<Lab />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/push-test" element={<PushTest />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/terrain" element={<TerrainEditorPage />} />
          <Route path="/results" element={<Results />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/hall-of-fame" element={<HallOfFamePage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
