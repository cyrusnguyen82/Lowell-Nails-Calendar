import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Android Chrome viewport height polyfill.
// --vh tracks window.innerHeight so calc(var(--vh) * 100) always equals
// the visible area regardless of whether the address bar is shown or hidden.
function syncVH() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
}
syncVH()
window.addEventListener('resize', syncVH)
window.addEventListener('orientationchange', () => setTimeout(syncVH, 120))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
