export type CatalogProduct = {
  id: string
  brand?: string
  name: string
  category: string
  price: number
  currency: string
  url: string
  imageUrl?: string
  tags: string[]
  skinTypes?: string[]
  concerns?: string[]
}

const publicCatalog: CatalogProduct[] = [
  {
    id: 'cerave-hydrating-facial-cleanser',
    brand: 'CeraVe',
    name: 'Hydrating Facial Cleanser',
    category: 'Cleanser',
    price: 16,
    currency: 'USD',
    url: 'https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser',
    tags: ['cleanser', 'ceramides', 'hyaluronic_acid', 'barrier'],
    skinTypes: ['Dry', 'Normal', 'Sensitive', 'Combination'],
  },
  {
    id: 'cerave-foaming-facial-cleanser',
    brand: 'CeraVe',
    name: 'Foaming Facial Cleanser',
    category: 'Cleanser',
    price: 16,
    currency: 'USD',
    url: 'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser',
    tags: ['cleanser', 'ceramides', 'niacinamide', 'oil_control'],
    skinTypes: ['Normal', 'Combination', 'Oily'],
    concerns: ['oiliness'],
  },
  {
    id: 'cerave-pm-facial-moisturizing-lotion',
    brand: 'CeraVe',
    name: 'PM Facial Moisturizing Lotion',
    category: 'Moisturizer',
    price: 18,
    currency: 'USD',
    url: 'https://www.cerave.com/skincare/moisturizers/pm-facial-moisturizing-lotion',
    tags: ['moisturizer', 'niacinamide', 'ceramides', 'hyaluronic_acid', 'barrier'],
    skinTypes: ['Normal', 'Combination', 'Oily', 'Sensitive'],
    concerns: ['redness', 'oiliness'],
  },
  {
    id: 'cerave-am-facial-moisturizing-lotion-spf30',
    brand: 'CeraVe',
    name: 'AM Facial Moisturizing Lotion SPF 30',
    category: 'Sunscreen',
    price: 19,
    currency: 'USD',
    url: 'https://www.cerave.com/skincare/moisturizers/am-facial-moisturizing-lotion-with-sunscreen',
    tags: ['sunscreen', 'spf', 'uv', 'ceramides', 'niacinamide'],
    skinTypes: ['Dry', 'Normal', 'Sensitive', 'Combination', 'Oily'],
    concerns: ['uneven_tone', 'wrinkles'],
  },
  {
    id: 'eltamd-uv-clear-spf46',
    brand: 'EltaMD',
    name: 'UV Clear Broad-Spectrum SPF 46',
    category: 'Sunscreen',
    price: 46,
    currency: 'USD',
    url: 'https://eltamd.com/products/uv-clear-broad-spectrum-spf-46',
    tags: ['sunscreen', 'spf', 'uv', 'niacinamide'],
    skinTypes: ['Sensitive', 'Normal', 'Combination', 'Oily'],
    concerns: ['redness', 'uneven_tone'],
  },
  {
    id: 'theordinary-niacinamide-10-zinc-1',
    brand: 'The Ordinary',
    name: 'Niacinamide 10% + Zinc 1%',
    category: 'Serum',
    price: 7,
    currency: 'USD',
    url: 'https://theordinary.com/en-us/niacinamide-10-zinc-1-serum-100436.html',
    tags: ['niacinamide', 'oil_control', 'pores'],
    skinTypes: ['Oily', 'Combination', 'Normal'],
    concerns: ['oiliness', 'redness', 'uneven_tone'],
  },
  {
    id: 'cerave-skin-renewing-vitamin-c-serum',
    brand: 'CeraVe',
    name: 'Skin Renewing Vitamin C Serum',
    category: 'Serum',
    price: 24,
    currency: 'USD',
    url: 'https://www.cerave.com/skincare/facial-serums/skin-renewing-vitamin-c-serum',
    tags: ['vitamin_c', 'brightening', 'antioxidants'],
    skinTypes: ['Dry', 'Normal', 'Combination', 'Oily'],
    concerns: ['uneven_tone', 'wrinkles'],
  },
  {
    id: 'theordinary-azelaic-acid-suspension-10',
    brand: 'The Ordinary',
    name: 'Azelaic Acid Suspension 10%',
    category: 'Treatment',
    price: 11,
    currency: 'USD',
    url: 'https://theordinary.com/en-us/azelaic-acid-suspension-10-exfoliator-100407.html',
    tags: ['azelaic_acid', 'redness', 'brightening'],
    skinTypes: ['Sensitive', 'Normal', 'Combination', 'Oily'],
    concerns: ['redness', 'uneven_tone', 'texture'],
  },
  {
    id: 'paulaschoice-skin-perfecting-2-bha-liquid',
    brand: "Paula's Choice",
    name: 'SKIN PERFECTING 2% BHA Liquid Exfoliant',
    category: 'Exfoliant',
    price: 35,
    currency: 'USD',
    url: 'https://www.paulaschoice.com/skin-perfecting-2pct-bha-liquid-exfoliant/201-2010.html',
    tags: ['bha', 'oil_control', 'pores', 'texture'],
    skinTypes: ['Normal', 'Combination', 'Oily'],
    concerns: ['oiliness', 'texture'],
  },
  {
    id: 'theordinary-glycolic-acid-7-toning-solution',
    brand: 'The Ordinary',
    name: 'Glycolic Acid 7% Exfoliating Toner',
    category: 'Exfoliant',
    price: 13,
    currency: 'USD',
    url: 'https://theordinary.com/en-us/glycolic-acid-7-exfoliating-toner-100418.html',
    tags: ['aha', 'texture', 'brightening'],
    skinTypes: ['Normal', 'Combination', 'Oily'],
    concerns: ['texture', 'uneven_tone'],
  },
  {
    id: 'theinkeylist-tranexamic-acid-serum',
    brand: 'The INKEY List',
    name: 'Tranexamic Acid Serum',
    category: 'Serum',
    price: 16,
    currency: 'USD',
    url: 'https://www.theinkeylist.com/products/tranexamic-acid-serum',
    tags: ['tranexamic', 'brightening'],
    skinTypes: ['Dry', 'Normal', 'Combination', 'Oily'],
    concerns: ['uneven_tone'],
  },
  {
    id: 'differin-adapalene-gel-0-1',
    brand: 'Differin',
    name: 'Differin Gel (Adapalene 0.1%)',
    category: 'Retinoid',
    price: 16,
    currency: 'USD',
    url: 'https://differin.com/shop/differin-gel/3029949.html',
    tags: ['retinoid', 'texture'],
    skinTypes: ['Normal', 'Combination', 'Oily'],
    concerns: ['oiliness', 'texture'],
  },
  {
    id: 'theordinary-retinol-0-2-in-squalane',
    brand: 'The Ordinary',
    name: 'Retinol 0.2% in Squalane',
    category: 'Retinoid',
    price: 8,
    currency: 'USD',
    url: 'https://theordinary.com/en-us/retinol-02-in-squalane-serum-100439.html',
    tags: ['retinoid', 'wrinkles', 'texture'],
    skinTypes: ['Dry', 'Normal', 'Combination', 'Oily'],
    concerns: ['wrinkles', 'texture'],
  },
  {
    id: 'theordinary-multi-peptide-ha-serum',
    brand: 'The Ordinary',
    name: 'Multi-Peptide + HA Serum',
    category: 'Serum',
    price: 19,
    currency: 'USD',
    url: 'https://theordinary.com/en-us/multi-peptide-ha-serum-100613.html',
    tags: ['peptides', 'hyaluronic_acid'],
    skinTypes: ['Dry', 'Normal', 'Combination', 'Oily'],
    concerns: ['wrinkles', 'texture'],
  },
  {
    id: 'theordinary-caffeine-solution-5-egcg',
    brand: 'The Ordinary',
    name: 'Caffeine Solution 5% + EGCG',
    category: 'Eye',
    price: 9,
    currency: 'USD',
    url: 'https://theordinary.com/en-us/caffeine-solution-5-egcg-eye-serum-100412.html',
    tags: ['caffeine', 'puffy_eyes'],
    skinTypes: ['Dry', 'Normal', 'Combination', 'Oily', 'Sensitive'],
    concerns: ['puffy_eyes'],
  },
  {
    id: 'larocheposay-cicaplast-balm-b5',
    brand: 'La Roche-Posay',
    name: 'Cicaplast Balm B5+',
    category: 'Treatment',
    price: 16,
    currency: 'USD',
    url: 'https://www.laroche-posay.us/our-products/body/body-lotion/cicaplast-balm-b5-for-dry-skin-irritations-cicaplastbalmb5.html',
    tags: ['panthenol', 'barrier'],
    skinTypes: ['Dry', 'Sensitive', 'Normal', 'Combination'],
    concerns: ['redness', 'texture'],
  },
]

const catalogCache = new Map<string, Promise<CatalogProduct[]>>()

function asString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const out = v.trim()
  return out.length > 0 ? out : undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
  return out.length > 0 ? out : undefined
}

function normalizeProduct(raw: unknown): CatalogProduct | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const id = asString(obj.id) ?? asString(obj.sku) ?? asString(obj.handle)
  const name = asString(obj.name) ?? asString(obj.title)
  const category = asString(obj.category) ?? asString(obj.type) ?? 'Product'
  const url = asString(obj.url) ?? asString(obj.productUrl) ?? asString(obj.link)

  const priceRaw = obj.price
  const price =
    typeof priceRaw === 'number'
      ? priceRaw
      : typeof priceRaw === 'string'
        ? Number(priceRaw)
        : NaN

  const currency = asString(obj.currency) ?? 'USD'
  const imageUrl = asString(obj.imageUrl) ?? asString(obj.image_url)
  const brand = asString(obj.brand)
  const tags = asStringArray(obj.tags) ?? []
  const skinTypes = asStringArray(obj.skinTypes) ?? asStringArray(obj.skin_types)
  const concerns = asStringArray(obj.concerns)

  if (!id || !name || !url || !Number.isFinite(price)) return null

  return {
    id,
    brand,
    name,
    category,
    price,
    currency,
    url,
    imageUrl,
    tags,
    skinTypes,
    concerns,
  }
}

export async function loadCatalog(params: {
  catalogUrl?: string
  brandName?: string
}): Promise<CatalogProduct[]> {
  const url = params.catalogUrl?.trim()
  if (!url) {
    return publicCatalog
  }

  if (!catalogCache.has(url)) {
    catalogCache.set(
      url,
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error(`catalog fetch failed (${res.status})`)
          return (await res.json()) as unknown
        })
        .then((data) => {
          const rawProducts =
            Array.isArray(data) ? data : (data as { products?: unknown }).products
          if (!Array.isArray(rawProducts)) return []
          return rawProducts.map(normalizeProduct).filter(Boolean) as CatalogProduct[]
        })
        .catch(() => []),
    )
  }

  const products = await catalogCache.get(url)!
  if (products.length > 0) {
    if (!params.brandName) return products
    return products.map((p) => ({ ...p, brand: p.brand ?? params.brandName }))
  }

  return publicCatalog
}
