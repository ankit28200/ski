import { Copy, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

import { cn } from '../lib/cn'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold tracking-wide text-white/70">{label}</span>
      {children}
      {hint ? <span className="text-xs text-white/50">{hint}</span> : null}
    </label>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none',
        'placeholder:text-white/35 focus:border-white/20',
        props.className,
      )}
    />
  )
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none',
        'focus:border-white/20',
        props.className,
      )}
    />
  )
}

function Button({
  variant,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  const v = variant ?? 'primary'
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'
  const style =
    v === 'primary'
      ? 'bg-white text-slate-900 hover:bg-white/95'
      : v === 'secondary'
        ? 'border border-white/12 bg-white/5 text-white hover:bg-white/10'
        : 'text-white/80 hover:bg-white/10'

  return <button {...props} className={cn(base, style, className)} />
}

function buildEmbedUrl(params: {
  appUrl: string
  apiUrl?: string
  theme: string
  brand?: string
  logo?: string
  primary?: string
  accent?: string
  catalog?: string
  origin?: string
}) {
  const base = params.appUrl.trim().replace(/\/$/, '')
  if (!base) return ''

  try {
    const url = new URL(base)
    url.pathname = url.pathname.replace(/\/$/, '') + '/scan'
    url.searchParams.set('embed', '1')
    url.searchParams.set('theme', params.theme)

    if (params.apiUrl) url.searchParams.set('api', params.apiUrl)
    if (params.brand) url.searchParams.set('brand', params.brand)
    if (params.logo) url.searchParams.set('logo', params.logo)
    if (params.primary) url.searchParams.set('primary', params.primary)
    if (params.accent) url.searchParams.set('accent', params.accent)
    if (params.catalog) url.searchParams.set('catalog', params.catalog)
    if (params.origin) url.searchParams.set('origin', params.origin)

    return url.toString()
  } catch {
    return ''
  }
}

export default function PartnerPage() {
  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  const [appUrl, setAppUrl] = useState(defaultOrigin)
  const [apiUrl, setApiUrl] = useState('')
  const [theme, setTheme] = useState('dark')
  const [brand, setBrand] = useState('Demo Beauty')
  const [logo, setLogo] = useState('')
  const [primary, setPrimary] = useState('#38bdf8')
  const [accent, setAccent] = useState('#a78bfa')
  const [catalog, setCatalog] = useState('')
  const [origin, setOrigin] = useState('')
  const [width, setWidth] = useState('100%')
  const [height, setHeight] = useState('760px')
  const [copied, setCopied] = useState(false)

  const previewUrl = useMemo(
    () =>
      buildEmbedUrl({
        appUrl,
        apiUrl: apiUrl || undefined,
        theme,
        brand: brand || undefined,
        logo: logo || undefined,
        primary: primary || undefined,
        accent: accent || undefined,
        catalog: catalog || undefined,
        origin: origin || undefined,
      }),
    [accent, apiUrl, appUrl, brand, catalog, logo, origin, primary, theme],
  )

  const scriptUrl = useMemo(() => {
    const base = appUrl.trim().replace(/\/$/, '')
    return base ? `${base}/embed.js` : ''
  }, [appUrl])

  const snippet = useMemo(() => {
    if (!scriptUrl || !appUrl) return ''

    const attrs: Array<[string, string]> = [
      ['data-skinsense-embed', ''],
      ['data-src', appUrl],
      ['data-theme', theme],
      ['data-width', width],
      ['data-height', height],
    ]

    if (apiUrl) attrs.push(['data-api', apiUrl])
    if (brand) attrs.push(['data-brand', brand])
    if (logo) attrs.push(['data-logo', logo])
    if (primary) attrs.push(['data-primary', primary])
    if (accent) attrs.push(['data-accent', accent])
    if (catalog) attrs.push(['data-catalog', catalog])
    if (origin) attrs.push(['data-origin', origin])

    const div =
      '<div\n' +
      attrs
        .map(([k, v]) => (v === '' ? `  ${k}` : `  ${k}="${v}"`))
        .join('\n') +
      '\n></div>'

    const script = `<script async src="${scriptUrl}"><\\/script>`

    return `${div}\n${script}`
  }, [accent, apiUrl, appUrl, brand, catalog, height, logo, origin, primary, scriptUrl, theme, width])

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div>
        <div className="text-2xl font-semibold text-white">Partner Demo</div>
        <div className="mt-2 max-w-3xl text-sm text-white/70">
          Generate a copy-paste embed snippet for any brand site, and preview the white-label widget.
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
          <div className="text-sm font-semibold text-white">Widget configuration</div>

          <div className="mt-5 grid gap-4">
            <Field
              label="App URL (where the widget is hosted)"
              hint="Example: https://yourdomain.com or http://localhost:5173"
            >
              <Input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} />
            </Field>

            <Field label="API URL (optional)" hint="Overrides the backend via ?api=...">
              <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.yourdomain.com/api" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Theme">
                <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                </Select>
              </Field>

              <Field label="Target postMessage origin (optional)" hint="Locks analytics events to one origin">
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://brand-site.com" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name">
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
              </Field>
              <Field label="Logo URL (optional)">
                <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://.../logo.png" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary color (hex)">
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#38bdf8" />
              </Field>
              <Field label="Accent color (hex)">
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#a78bfa" />
              </Field>
            </div>

            <Field label="Catalog URL (optional)" hint="Points to a JSON product feed for recommendations">
              <Input value={catalog} onChange={(e) => setCatalog(e.target.value)} placeholder="https://brand.com/skinsense-catalog.json" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Widget width">
                <Input value={width} onChange={(e) => setWidth(e.target.value)} />
              </Field>
              <Field label="Widget height">
                <Input value={height} onChange={(e) => setHeight(e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">Embed snippet</div>
                <div className="mt-2 text-sm text-white/70">
                  Paste this into the brand website where you want the widget to appear.
                </div>
              </div>
              <Button variant="secondary" onClick={copyToClipboard} disabled={!snippet}>
                <Copy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <textarea
              readOnly
              value={snippet}
              rows={10}
              className="mt-4 w-full rounded-3xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/80 outline-none"
            />

            {scriptUrl ? (
              <a
                href={scriptUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Open embed.js
              </a>
            ) : null}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="text-sm font-semibold text-white">Live preview</div>
            <div className="mt-2 text-sm text-white/70">This is what partners will see.</div>

            {previewUrl ? (
              <div className="mt-4 overflow-hidden rounded-[2rem] border border-white/10 bg-black">
                <iframe
                  title="SkinSense preview"
                  src={previewUrl}
                  style={{ width: '100%', height, border: 0 }}
                  allow="camera; clipboard-read; clipboard-write"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                Enter a valid App URL to preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
