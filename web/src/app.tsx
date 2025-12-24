import { Activity, Building2, Calculator, History, LineChart, ScanFace } from 'lucide-react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
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

function Nav({ brand }: { brand: BrandConfig }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
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
            <div className="text-xs text-white/60">Skin analysis • routine • progress</div>
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

  return (
    <Link
      to={to}
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
                    to="/"
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
