export type BrandConfig = {
  name: string
  brandQuery?: string
  logoUrl?: string
  primary?: string
  accent?: string
  catalogUrl?: string
  targetOrigin?: string
}

export function hexToRgb(hex: string): string | undefined {
  const trimmed = hex.trim()
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!match) return undefined

  let h = match[1]
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => `${c}${c}`)
      .join('')
  }

  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return undefined
  return `${r}, ${g}, ${b}`
 }

function clean(v: string | null): string | undefined {
  if (!v) return undefined
  const out = v.trim()
  return out.length > 0 ? out : undefined
}

export function readBrandConfig(search?: string): BrandConfig {
  const params =
    typeof window === 'undefined'
      ? new URLSearchParams(search ?? '')
      : new URLSearchParams(search ?? window.location.search)

  const brandQuery = clean(params.get('brand'))
  const logoUrl = clean(params.get('logo'))
  const primary = clean(params.get('primary'))
  const accent = clean(params.get('accent'))
  const catalogUrl = clean(params.get('catalog'))
  const targetOrigin = clean(params.get('origin'))

  return {
    name: brandQuery ?? 'SkinSense AI',
    brandQuery,
    logoUrl,
    primary,
    accent,
    catalogUrl,
    targetOrigin,
  }
}

export function applyBrandConfig(cfg: BrandConfig) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  if (cfg.primary) {
    root.style.setProperty('--brand-primary', cfg.primary)
    const rgb = hexToRgb(cfg.primary)
    if (rgb) root.style.setProperty('--brand-primary-rgb', rgb)
  }
  if (cfg.accent) {
    root.style.setProperty('--brand-accent', cfg.accent)
    const rgb = hexToRgb(cfg.accent)
    if (rgb) root.style.setProperty('--brand-accent-rgb', rgb)
  }
}
