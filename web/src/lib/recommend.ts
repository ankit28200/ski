import type { AnalysisResponse, MetricResult } from './types'
import type { CatalogProduct } from './catalog'

export type IngredientEvidenceLink = {
  label: string
  url: string
}

export type IngredientRecommendation = {
  id: string
  name: string
  why: string
  caution?: string
  links?: IngredientEvidenceLink[]
}

export type RecommendationResult = {
  ingredients: IngredientRecommendation[]
  products: CatalogProduct[]
}

function topConcerns(metrics: MetricResult[], n: number): string[] {
  return metrics
    .slice()
    .sort((a, b) => b.severity - a.severity)
    .slice(0, n)
    .map((m) => m.id)
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  return out
}

function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const it of items) {
    const v = it.trim()
    if (!v) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function mapUserConcernsToIds(concerns: string[]): string[] {
  const out: string[] = []
  for (const c of concerns) {
    const v = c.trim().toLowerCase()
    if (!v) continue
    if (v === 'dark spots') {
      out.push('uneven_tone')
      continue
    }
    if (v === 'fine lines') {
      out.push('wrinkles')
      continue
    }
    if (v === 'acne') {
      out.push('oiliness', 'texture')
      continue
    }
    if (v === 'dryness') {
      out.push('dryness', 'barrier')
      continue
    }
    out.push(v.replace(/\s+/g, '_'))
  }
  return out
}

function mapGoalsToConcernIds(goals: string[], skinType: string): string[] {
  const out: string[] = []
  for (const g of goals) {
    const v = g.trim().toLowerCase()
    if (!v) continue
    if (v === 'even tone') out.push('uneven_tone')
    if (v === 'clear pores') out.push('oiliness', 'texture')
    if (v === 'calm irritation') out.push('redness', 'barrier')
    if (v === 'anti-aging') out.push('wrinkles', 'texture')
    if (v === 'glow') out.push('uneven_tone', 'texture')
    if (v === 'hydration') out.push('dryness', 'barrier')
  }

  if (skinType === 'Dry') out.push('dryness', 'barrier')
  if (skinType === 'Sensitive') out.push('redness', 'barrier')

  return out
}

function isSensitiveProfile(analysis: AnalysisResponse): boolean {
  const redness = analysis.metrics.find((m) => m.id === 'redness')
  const red = redness ? redness.severity : 0
  return analysis.skin_type === 'Sensitive' || red >= 55
}

const INGREDIENTS_BY_CONCERN: Record<string, IngredientRecommendation[]> = {
  oiliness: [
    {
      id: 'niacinamide',
      name: 'Niacinamide',
      why: 'Helps balance oil, improve appearance of pores, and support barrier function.',
      caution: 'Start low if sensitive; avoid stacking too many strong actives at once.',
      links: [
        { label: 'DermNet: Nicotinamide', url: 'https://dermnetnz.org/topics/nicotinamide' },
        { label: 'Safety: Patch testing', url: 'https://dermnetnz.org/topics/patch-tests' },
      ],
    },
    {
      id: 'bha',
      name: 'BHA (salicylic acid)',
      why: 'Oil-soluble exfoliant that can help clear pores and reduce congestion.',
      caution: 'Can be drying/irritating; use 1–3x/week initially and always wear SPF.',
      links: [
        { label: 'DermNet: Salicylic acid', url: 'https://dermnetnz.org/topics/salicylic-acid' },
        { label: 'Safety: Sun protection', url: 'https://dermnetnz.org/topics/sun-protection' },
      ],
    },
  ],
  redness: [
    {
      id: 'azelaic',
      name: 'Azelaic acid',
      why: 'Can help calm visible redness and support more even-looking skin.',
      caution: 'Patch test; may tingle at first.',
      links: [
        { label: 'DermNet: Azelaic acid', url: 'https://dermnetnz.org/topics/azelaic-acid' },
        { label: 'Safety: Patch testing', url: 'https://dermnetnz.org/topics/patch-tests' },
      ],
    },
    {
      id: 'panthenol',
      name: 'Panthenol / soothing humectants',
      why: 'Supports hydration and helps reduce irritation from other actives.',
      links: [
        { label: 'DermNet: Moisturisers', url: 'https://dermnetnz.org/topics/emollients-and-moisturisers' },
        { label: 'DermNet: Barrier cream', url: 'https://dermnetnz.org/topics/barrier-cream' },
      ],
    },
  ],
  uneven_tone: [
    {
      id: 'vitamin_c',
      name: 'Vitamin C',
      why: 'Antioxidant that can help brighten and support more even tone.',
      caution: 'Some forms can sting; introduce slowly.',
      links: [
        { label: 'DermNet: Topical vitamin C', url: 'https://dermnetnz.org/topics/topical-vitamin-c' },
        { label: 'Safety: Contact dermatitis', url: 'https://dermnetnz.org/topics/contact-dermatitis' },
      ],
    },
    {
      id: 'tranexamic',
      name: 'Tranexamic acid (optional)',
      why: 'Often used to support the look of discoloration and uneven tone.',
      links: [
        { label: 'DermNet: Tranexamic acid', url: 'https://dermnetnz.org/topics/tranexamic-acid' },
        { label: 'Safety: Patch testing', url: 'https://dermnetnz.org/topics/patch-tests' },
      ],
    },
  ],
  texture: [
    {
      id: 'retinoid',
      name: 'Retinoid',
      why: 'Supports smoother texture and the look of fine lines over time.',
      caution: 'Start 1–2x/week; avoid during pregnancy; moisturize and wear SPF.',
      links: [
        { label: 'DermNet: Topical retinoids', url: 'https://dermnetnz.org/topics/topical-retinoids' },
        { label: 'Safety: Sun protection', url: 'https://dermnetnz.org/topics/sun-protection' },
      ],
    },
    {
      id: 'aha',
      name: 'AHA (lactic/glycolic)',
      why: 'Exfoliates surface to help smoother appearance and glow.',
      caution: 'Can increase sensitivity; don’t over-exfoliate; always wear SPF.',
      links: [
        {
          label: 'DermNet: AHA facial treatments',
          url: 'https://dermnetnz.org/topics/alpha-hydroxy-acid-facial-treatments',
        },
        { label: 'Safety: Sun protection', url: 'https://dermnetnz.org/topics/sun-protection' },
      ],
    },
  ],
  wrinkles: [
    {
      id: 'retinoid',
      name: 'Retinoid',
      why: 'Well-studied ingredient for supporting the look of fine lines.',
      caution: 'Start low and slow; moisturize; use SPF daily.',
      links: [
        { label: 'DermNet: Topical retinoids', url: 'https://dermnetnz.org/topics/topical-retinoids' },
        { label: 'Safety: Sun protection', url: 'https://dermnetnz.org/topics/sun-protection' },
      ],
    },
    {
      id: 'peptides',
      name: 'Peptides (optional)',
      why: 'Often used for a smoother, firmer-looking appearance.',
      links: [
        { label: 'DermNet: Ageing skin', url: 'https://dermnetnz.org/topics/ageing-skin' },
      ],
    },
  ],
  puffy_eyes: [
    {
      id: 'caffeine',
      name: 'Caffeine (eye products)',
      why: 'Can help reduce the look of puffiness temporarily.',
      caution: 'Use gently; avoid getting product into eyes.',
      links: [
        { label: 'DermNet: Dark circles', url: 'https://dermnetnz.org/topics/dark-circles-under-the-eyes' },
        { label: 'Safety: Eyelid dermatitis', url: 'https://dermnetnz.org/topics/eyelid-contact-dermatitis' },
      ],
    },
  ],
  dryness: [
    {
      id: 'ceramides',
      name: 'Ceramides / barrier lipids',
      why: 'Supports a stronger skin barrier and can help reduce dryness over time.',
      caution: 'If you have sensitive skin, choose fragrance-free formulas and patch test first.',
      links: [
        { label: 'DermNet: Barrier cream', url: 'https://dermnetnz.org/topics/barrier-cream' },
        { label: 'DermNet: Skin barrier', url: 'https://dermnetnz.org/topics/skin-barrier-function' },
      ],
    },
    {
      id: 'hyaluronic_acid',
      name: 'Humectants (hyaluronic acid, glycerin)',
      why: 'Helps attract and retain water in the outer layer of skin; pair with a moisturiser to lock it in.',
      links: [
        { label: 'DermNet: Moisturisers', url: 'https://dermnetnz.org/topics/emollients-and-moisturisers' },
        { label: 'DermNet: Dry skin', url: 'https://dermnetnz.org/topics/dry-skin' },
      ],
    },
  ],
  barrier: [
    {
      id: 'ceramides',
      name: 'Ceramides / barrier lipids',
      why: 'Helps support a healthier barrier so skin is less reactive and more comfortable.',
      caution: 'Choose simpler, fragrance-free products if you’re easily irritated.',
      links: [
        { label: 'DermNet: Barrier cream', url: 'https://dermnetnz.org/topics/barrier-cream' },
        { label: 'DermNet: Skin barrier', url: 'https://dermnetnz.org/topics/skin-barrier-function' },
      ],
    },
    {
      id: 'barrier_moisturizer',
      name: 'Barrier moisturiser (bland, fragrance-free)',
      why: 'A consistent moisturising routine can improve tolerance of actives and reduce visible irritation.',
      caution: 'Introduce one new product at a time and patch test if you react easily.',
      links: [
        { label: 'DermNet: Moisturisers', url: 'https://dermnetnz.org/topics/emollients-and-moisturisers' },
        { label: 'Safety: Patch testing', url: 'https://dermnetnz.org/topics/patch-tests' },
      ],
    },
  ],
}

function scoreProduct(
  p: CatalogProduct,
  ctx: { skinType: string; concerns: string[]; sensitive: boolean },
): number {
  let score = 0

  if (p.skinTypes && p.skinTypes.includes(ctx.skinType)) score += 2

  for (const concern of ctx.concerns) {
    if (p.concerns && p.concerns.includes(concern)) score += 3
  }

  for (const t of p.tags) {
    if (ctx.concerns.includes('oiliness') && ['niacinamide', 'bha', 'oil_control', 'pores'].includes(t)) score += 1
    if (ctx.concerns.includes('redness') && ['azelaic_acid', 'panthenol', 'redness', 'barrier'].includes(t))
      score += 1
    if (ctx.concerns.includes('uneven_tone') && ['vitamin_c', 'brightening', 'tranexamic', 'antioxidants'].includes(t))
      score += 1
    if (ctx.concerns.includes('texture') && ['retinoid', 'aha', 'bha', 'texture'].includes(t)) score += 1
    if (ctx.concerns.includes('wrinkles') && ['retinoid', 'peptides', 'wrinkles', 'antioxidants'].includes(t))
      score += 1
    if (ctx.concerns.includes('puffy_eyes') && ['caffeine', 'puffy_eyes'].includes(t)) score += 1
    if (
      (ctx.concerns.includes('dryness') || ctx.concerns.includes('barrier')) &&
      ['ceramides', 'hyaluronic_acid', 'barrier', 'moisturizer'].includes(t)
    )
      score += 1
  }

  if (ctx.sensitive) {
    if (p.tags.some((t) => ['barrier', 'ceramides', 'panthenol', 'hyaluronic_acid'].includes(t))) score += 1

    const hasStrongActives = p.tags.some((t) => ['retinoid', 'aha', 'bha'].includes(t))
    if (hasStrongActives) {
      const wantsActives = ctx.concerns.some((c) => ['wrinkles', 'texture', 'oiliness'].includes(c))
      score -= wantsActives ? 0.5 : 2
    }
  }

  if (p.price <= 12) score += 1
  else if (p.price <= 20) score += 0.5
  else if (p.price >= 45) score -= 0.5

  return score
}

export function buildRecommendations(params: {
  analysis: AnalysisResponse
  catalog: CatalogProduct[]
  concerns?: string[]
  goals?: string[]
  maxProducts?: number
}): RecommendationResult {
  const { analysis, catalog } = params
  const maxProducts = params.maxProducts ?? 6

  const top = topConcerns(analysis.metrics, 3)

  const userConcerns = mapUserConcernsToIds(params.concerns ?? [])
  const userGoals = mapGoalsToConcernIds(params.goals ?? [], analysis.skin_type)
  const allConcerns = uniqStrings([...top, ...userConcerns, ...userGoals])

  const ingredients = uniqById(
    allConcerns.flatMap((c) => {
      const list = INGREDIENTS_BY_CONCERN[c]
      return list ? list : []
    }),
  )

  const ctx = { skinType: analysis.skin_type, concerns: allConcerns, sensitive: isSensitiveProfile(analysis) }
  const scored = catalog
    .map((p) => ({ p, s: scoreProduct(p, ctx) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, maxProducts)
    .map((x) => x.p)

  return {
    ingredients,
    products: scored,
  }
}
