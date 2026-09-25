import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes reales del sitio institucional (apps/public_web usa next/font con las
// mismas familias); Vite no tiene ese helper, se autoalojan vía @fontsource.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
