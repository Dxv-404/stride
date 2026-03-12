import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// StrictMode removed: causes double-mount in dev which conflicts
// with PixiJS's async WebGL init (batcher gets null GPU buffers).
// Production builds are unaffected (StrictMode is dev-only).
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
