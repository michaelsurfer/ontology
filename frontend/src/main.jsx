import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/* Prevent Vite overlay from blocking UI on known benign ResizeObserver warnings. */
function shouldSuppressBenignBrowserError(errorMessage) {
  return String(errorMessage || '').includes('ResizeObserver loop')
}

window.addEventListener(
  'error',
  (event) => {
    const message = String(event?.message || '')
    if (shouldSuppressBenignBrowserError(message)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  },
  true,
)

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event?.reason?.message || event?.reason || '')
  if (shouldSuppressBenignBrowserError(message)) {
    event.preventDefault()
  }
})

window.onerror = function onWindowError(message) {
  if (shouldSuppressBenignBrowserError(message)) {
    return true
  }
  return false
}

/* Mount the React app into the root DOM node. */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
