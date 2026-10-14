import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Earlier versions kept demo data and a session in the browser. Remove those leftovers:
// the server is the source of truth now.
try {
  Object.keys(localStorage).filter(k => k.startsWith('vp_')).forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem('vp_user');
} catch { /* storage unavailable */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
