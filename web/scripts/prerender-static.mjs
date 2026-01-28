import { promises as fs } from 'node:fs'
import path from 'node:path'

const ORIGIN = (() => {
  const fromEnv = process.env.SITE_URL || process.env.VITE_SITE_URL
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.replace(/\/$/, '')

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl && vercelUrl.trim().length > 0) return `https://${vercelUrl.replace(/\/$/, '')}`

  return 'http://localhost:5173'
})()
const BASE_TITLE = 'SkinSense AI'

const descLanding =
  'Free online AI skin analysis. Upload a selfie, get skin insights, a personalized routine, and product matches.'
const descScan =
  'Start a free AI skin scan. Upload a selfie or use your camera, answer a few questions, and get your routine and product matches.'
const descHair =
  'Start a free AI hair + scalp scan. Upload photos and get hair/scalp insights and a suggested routine.'

const ROUTES = [
  {
    route: '/scan',
    title: `${BASE_TITLE} — AI Skin Scan`,
    desc: descScan,
    canonicalPath: '/scan',
  },
  {
    route: '/hair',
    title: `${BASE_TITLE} — AI Hair Scan`,
    desc: descHair,
    canonicalPath: '/hair',
  },
  {
    route: '/calculator',
    title: `${BASE_TITLE} — ROI Calculator`,
    desc: 'Estimate revenue lift and acquisition savings from adding AI skin analysis to your funnel.',
    canonicalPath: '/calculator',
  },
]

function replaceMeta(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html
}

function applySeo(html, { title, desc, canonicalPath }) {
  const canonicalUrl = `${ORIGIN}${canonicalPath}`
  const ogImageUrl = `${ORIGIN}/og.svg`

  let out = html

  out = replaceMeta(out, /<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  out = replaceMeta(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta name="description" content="${desc}">`,
  )
  out = replaceMeta(
    out,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>(?:\s*)/i,
    `<link rel="canonical" href="${canonicalUrl}">`,
  )

  out = replaceMeta(
    out,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta property="og:title" content="${title}">`,
  )
  out = replaceMeta(
    out,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta property="og:description" content="${desc}">`,
  )
  out = replaceMeta(
    out,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta property="og:url" content="${canonicalUrl}">`,
  )

  out = replaceMeta(
    out,
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta property="og:image" content="${ogImageUrl}">`,
  )

  out = replaceMeta(
    out,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta name="twitter:title" content="${title}">`,
  )
  out = replaceMeta(
    out,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta name="twitter:description" content="${desc}">`,
  )

  out = replaceMeta(
    out,
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta name="twitter:image" content="${ogImageUrl}">`,
  )

  out = out.replace(/"url"\s*:\s*"[^"]*"/i, `"url": "${ORIGIN}/"`)

  return out
}

async function main() {
  const distDir = path.join(process.cwd(), 'dist')
  const baseHtmlPath = path.join(distDir, 'index.html')

  const baseHtml = await fs.readFile(baseHtmlPath, 'utf8')

  await Promise.all(
    ROUTES.map(async (r) => {
      const routeDir = path.join(distDir, r.route.replace(/^\//, ''))
      await fs.mkdir(routeDir, { recursive: true })

      const html = applySeo(baseHtml, r)
      await fs.writeFile(path.join(routeDir, 'index.html'), html, 'utf8')
    }),
  )

  const rootHtml = applySeo(baseHtml, {
    title: `${BASE_TITLE} — Online Skin Analysis`,
    desc: descLanding,
    canonicalPath: '/',
  })
  await fs.writeFile(baseHtmlPath, rootHtml, 'utf8')

  const routesForSitemap = ['/', '/scan', '/hair', '/calculator', '/partner']
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routesForSitemap
    .map((p) => `  <url>\n    <loc>${ORIGIN}${p}</loc>\n  </url>`)
    .join('\n')}\n</urlset>\n`

  await fs.writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8')

  const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`
  await fs.writeFile(path.join(distDir, 'robots.txt'), robotsTxt, 'utf8')
}

main().catch((e) => {
  console.error('[prerender-static] failed', e)
  process.exit(1)
})
