import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './app'
import './styles.css'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: any[]) => void
  }
}

const gaMeasurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined

if (gaMeasurementId && typeof document !== 'undefined') {
  const existing = document.querySelector(`script[src^="https://www.googletagmanager.com/gtag/js?id="]`)
  if (!existing) {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`
    document.head.appendChild(s)
  }

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function (...args: any[]) {
    window.dataLayer?.push(args)
  }

  window.gtag('js', new Date())
  window.gtag('config', gaMeasurementId, { send_page_view: false })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
