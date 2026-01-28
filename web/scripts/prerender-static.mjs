import { promises as fs } from 'node:fs'
import path from 'node:path'

const ORIGIN = 'https://ski-37sfde7ch-ankits-projects-658ddc57.vercel.app'
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
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta name="twitter:title" content="${title}">`,
  )
  out = replaceMeta(
    out,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
    `<meta name="twitter:description" content="${desc}">`,
  )

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
}

main().catch((e) => {
  console.error('[prerender-static] failed', e)
  process.exit(1)
})
