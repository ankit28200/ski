import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { readBrandConfig } from '../lib/brand'
import { cn } from '../lib/cn'

function buildWidgetSrc(search: string, brandName: string) {
  const params = new URLSearchParams(search)

  const api = params.get('api')
  const logo = params.get('logo')
  const primary = params.get('primary')
  const accent = params.get('accent')
  const catalog = params.get('catalog')
  const origin = params.get('origin')

  const out = new URLSearchParams()
  out.set('embed', '1')
  out.set('brand', brandName)

  if (api && api.trim()) out.set('api', api)
  if (logo && logo.trim()) out.set('logo', logo)
  if (primary && primary.trim()) out.set('primary', primary)
  if (accent && accent.trim()) out.set('accent', accent)
  if (catalog && catalog.trim()) out.set('catalog', catalog)
  if (origin && origin.trim()) out.set('origin', origin)

  return `/scan?${out.toString()}`
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</div>
    </div>
  )
}

export default function DemoPage() {
  const location = useLocation()
  const cfg = useMemo(() => readBrandConfig(location.search), [location.search])

  const brandName = cfg.brandQuery ?? 'Aurora Botanics'
  const widgetSrc = useMemo(
    () => buildWidgetSrc(location.search, brandName),
    [brandName, location.search],
  )

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl text-sm font-semibold text-white"
              style={{ background: 'rgb(var(--brand-primary-rgb))' }}
            >
              {brandName.slice(0, 1).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{brandName}</div>
              <div className="text-xs text-slate-500">Demo brand site + SkinSense integration</div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-700 md:flex">
            <a href="#bestsellers" className="hover:text-slate-950">
              Bestsellers
            </a>
            <a href="#why" className="hover:text-slate-950">
              Why it converts
            </a>
            <a href="#quiz" className="hover:text-slate-950">
              AI Skin Quiz
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#quiz"
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white',
                'shadow-sm transition hover:opacity-95',
              )}
              style={{ background: 'rgb(var(--brand-primary-rgb))' }}
            >
              Take skin quiz
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5" style={{ color: 'rgb(var(--brand-accent-rgb))' }} />
              Personalised routine in minutes
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Skincare that adapts to your skin — not trends.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              This is a pitch demo: a brand-style landing page that embeds the SkinSense AI scan widget.
              It shows partners exactly what their customers would experience.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#quiz"
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white',
                  'shadow-sm transition hover:opacity-95',
                )}
                style={{ background: 'rgb(var(--brand-primary-rgb))' }}
              >
                Try the AI skin quiz
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to={`/partner${location.search}`}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900',
                  'transition hover:bg-slate-50',
                )}
              >
                Get embed code
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-[1.5rem] bg-gradient-to-b from-slate-50 to-white p-6">
              <div className="text-xs font-semibold tracking-wide text-slate-600">WHAT YOU’RE SEEING</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">White-label integration</div>
              <div className="mt-4 grid gap-4">
                <Feature
                  title="On-site conversion"
                  desc="Customers get a routine and product suggestions without leaving your site."
                />
                <Feature
                  title="Catalog-restricted recommendations"
                  desc="Recommendations can be limited to a JSON catalog feed so every product is buyable."
                />
                <Feature
                  title="Safety guardrails"
                  desc="Cosmetic-style insights only (no medical diagnosis) + urgent care guidance when needed."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="bestsellers">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="text-sm font-semibold text-slate-950">Bestsellers (placeholder)</div>
          <div className="mt-2 max-w-3xl text-sm text-slate-600">
            These are styling placeholders. In a real integration, the quiz can recommend products from your actual
            catalog feed.
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Gentle Cleanser', desc: 'Balanced pH, non-stripping. Great for daily use.' },
              { name: 'Hydration Serum', desc: 'Lightweight hydration with barrier support.' },
              { name: 'Daily SPF', desc: 'Broad-spectrum daily protection for all skin types.' },
            ].map((p) => (
              <div key={p.name} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div
                  className="h-36 rounded-3xl"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.18), rgba(var(--brand-accent-rgb), 0.16))',
                  }}
                />
                <div className="mt-4 text-sm font-semibold text-slate-950">{p.name}</div>
                <div className="mt-2 text-sm text-slate-600">{p.desc}</div>
                <div className="mt-4">
                  <a href="#quiz" className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50">
                    Find my routine
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <ShieldCheck className="h-5 w-5" />
                Brand-safe
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Disclaimers + conservative language reduce risky medical claims.
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Sparkles className="h-5 w-5" />
                Personalised
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Tailors focus areas and routine steps based on scan + answers.
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <ArrowRight className="h-5 w-5" />
                Shoppable
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Recommendations can link directly to PDPs or checkout flows.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="quiz" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">Embedded AI Skin Quiz</div>
              <div className="mt-2 max-w-3xl text-sm text-slate-600">
                This is the real SkinSense scan flow embedded as a widget.
              </div>
            </div>
            <Link
              to={`/scan${location.search}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Open full experience
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm">
            <iframe
              title="SkinSense widget"
              src={widgetSrc}
              style={{ width: '100%', height: '820px', border: 0 }}
              allow="camera; clipboard-read; clipboard-write"
            />
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Demo disclaimer: cosmetic-style insights only, not a medical diagnosis.
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-xs text-slate-500">
          <div className="max-w-3xl">
            This page is a demo to show how SkinSense can be integrated into a partner brand website.
          </div>
        </div>
      </footer>
    </main>
  )
}
