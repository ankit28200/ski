import { Activity, Building2, Calculator, History, LineChart, ScanFace } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'

import { applyBrandConfig, readBrandConfig } from './lib/brand'
import type { BrandConfig } from './lib/brand'
import CalculatorPage from './routes/calculator'
import DemoPage from './routes/demo'
import HistoryPage from './routes/history'
import LandingPage from './routes/landing'
import PartnerPage from './routes/partner'
import ProgressPage from './routes/progress'
import ScanPage from './routes/scan'

function HairRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('mode', 'hair')
  return <Navigate to={`/scan?${params.toString()}`} replace />
}

function Nav({ brand }: { brand: BrandConfig }) {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to={`/${location.search}`} className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white/10 shadow-glow">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <ScanFace
                className="h-5 w-5"
                style={{ color: 'rgb(var(--brand-primary-rgb))' }}
              />
            )}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-white">{brand.name}</div>
            <div className="text-xs text-white/60">Skin + hair analysis • routine • progress</div>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/scan" icon={<Activity className="h-4 w-4" />} label="Analyze" />
          <NavLink to="/calculator" icon={<Calculator className="h-4 w-4" />} label="Calculator" />
          <NavLink to="/history" icon={<History className="h-4 w-4" />} label="History" />
          <NavLink to="/progress" icon={<LineChart className="h-4 w-4" />} label="Progress" />
          <NavLink to="/partner" icon={<Building2 className="h-4 w-4" />} label="Partner" />
        </nav>
      </div>
    </header>
  )
}

function NavLink({
  to,
  label,
  icon,
}: {
  to: string
  label: string
  icon: ReactNode
}) {
  const location = useLocation()
  const active = location.pathname === to
  const toWithSearch = `${to}${location.search}`

  return (
    <Link
      to={toWithSearch}
      className={
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition " +
        (active
          ? 'bg-white/12 text-white shadow-glow'
          : 'text-white/70 hover:bg-white/10 hover:text-white')
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10 text-xs text-white/60">
        <div className="max-w-3xl">
          SkinSense AI provides cosmetic-style insights only and is not a medical diagnosis.
          If you have persistent irritation or concerns, consult a qualified dermatologist.
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const location = useLocation()
  const brand = useMemo(() => readBrandConfig(location.search), [location.search])

  useEffect(() => {
    applyBrandConfig(brand)
  }, [brand])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const t = window.setTimeout(() => {
      document.dispatchEvent(new Event('prerender-ready'))
    }, 0)
    return () => window.clearTimeout(t)
  }, [location.pathname])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const origin = 'https://ski-37sfde7ch-ankits-projects-658ddc57.vercel.app'
    const baseTitle = brand.name && brand.name.trim().length > 0 ? brand.name.trim() : 'SkinSense AI'
    const path = location.pathname
    const params = new URLSearchParams(location.search)

    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    const metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null
    const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null

    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null

    const twTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement | null
    const twDesc = document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement | null

    const descLanding =
      'Free online AI skin analysis. Upload a selfie, get skin insights, a personalized routine, and product matches.'
    const descScan =
      'Start a free AI skin scan. Upload a selfie or use your camera, answer a few questions, and get your routine and product matches.'
    const descHair =
      'Start a free AI hair + scalp scan. Upload photos and get hair/scalp insights and a suggested routine.'

    let title = baseTitle
    let desc = descLanding
    let canonicalPath = path

    if (path === '/scan') {
      const mode = params.get('mode')
      if (mode === 'hair') {
        title = `${baseTitle} — AI Hair Scan`
        desc = descHair
        canonicalPath = '/hair'
      } else {
        title = `${baseTitle} — AI Skin Scan`
        desc = descScan
        canonicalPath = '/scan'
      }
    } else if (path === '/hair') {
      title = `${baseTitle} — AI Hair Scan`
      desc = descHair
    } else if (path === '/calculator') {
      title = `${baseTitle} — ROI Calculator`
      desc = 'Estimate revenue lift and acquisition savings from adding AI skin analysis to your funnel.'
    } else if (path === '/partner') {
      title = `${baseTitle} — Partner Embed`
      desc = 'Generate an embed snippet to add SkinSense AI to your website.'
    } else if (path === '/progress') {
      title = `${baseTitle} — Progress`
      desc = 'Track your skin progress over time and compare scans.'
    } else if (path === '/history') {
      title = `${baseTitle} — History`
      desc = 'Review your previous AI skin scans and results.'
    } else if (path === '/') {
      title = `${baseTitle} — Online Skin Analysis`
      desc = descLanding
    }

    const canonicalUrl = `${origin}${canonicalPath}`

    const isEmbed = params.get('embed') === '1'
    const hasBrandParams =
      params.has('brand') ||
      params.has('catalog') ||
      params.has('logo') ||
      params.has('primary') ||
      params.has('accent') ||
      params.has('origin')
    const shouldNoIndex = isEmbed || hasBrandParams

    document.title = title
    if (metaDesc) metaDesc.content = desc

    if (canonicalLink) canonicalLink.href = canonicalUrl
    if (metaRobots) {
      metaRobots.content = shouldNoIndex
        ? 'noindex,nofollow'
        : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    }

    if (ogTitle) ogTitle.content = title
    if (ogDesc) ogDesc.content = desc
    if (ogUrl) ogUrl.content = canonicalUrl

    if (twTitle) twTitle.content = title
    if (twDesc) twDesc.content = desc
  }, [brand.name, location.pathname, location.search])

  const isEmbed = new URLSearchParams(location.search).get('embed') === '1'
  const isDemo = location.pathname === '/demo'
  const hideChrome = isEmbed || isDemo

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      {!hideChrome && <Nav brand={brand} />}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/hair" element={<HairRedirect />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/partner" element={<PartnerPage />} />
        <Route
          path="*"
          element={
            <main className="mx-auto max-w-6xl px-4 py-20">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-glow">
                <div className="text-lg font-semibold text-white">Page not found</div>
                <div className="mt-2 text-sm text-white/70">
                  The page you’re looking for doesn’t exist.
                </div>
                <div className="mt-6">
                  <Link
                    to={`/${location.search}`}
                    className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Back home
                  </Link>
                </div>
              </div>
            </main>
          }
        />
      </Routes>

      {!hideChrome && <Footer />}
    </div>
  )
}
