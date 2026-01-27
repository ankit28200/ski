import react from '@vitejs/plugin-react-swc'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'path'
import { defineConfig } from 'vite'

const require = createRequire(import.meta.url)
const vitePrerender = require('vite-plugin-prerender') as any

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [
    react(),
    vitePrerender({
      staticDir: path.join(__dirname, 'dist'),
      routes: ['/', '/scan', '/hair', '/calculator'],
      postProcess: (ctx: { html: string; route: string }) => {
        const origin = 'https://ski-37sfde7ch-ankits-projects-658ddc57.vercel.app'
        const baseTitle = 'SkinSense AI'

        const descLanding =
          'Free online AI skin analysis. Upload a selfie, get skin insights, a personalized routine, and product matches.'
        const descScan =
          'Start a free AI skin scan. Upload a selfie or use your camera, answer a few questions, and get your routine and product matches.'
        const descHair =
          'Start a free AI hair + scalp scan. Upload photos and get hair/scalp insights and a suggested routine.'

        let title = `${baseTitle} — Online Skin Analysis`
        let desc = descLanding
        let canonicalPath = ctx.route

        if (ctx.route === '/scan') {
          title = `${baseTitle} — AI Skin Scan`
          desc = descScan
          canonicalPath = '/scan'
        } else if (ctx.route === '/hair') {
          title = `${baseTitle} — AI Hair Scan`
          desc = descHair
          canonicalPath = '/hair'
        } else if (ctx.route === '/calculator') {
          title = `${baseTitle} — ROI Calculator`
          desc = 'Estimate revenue lift and acquisition savings from adding AI skin analysis to your funnel.'
          canonicalPath = '/calculator'
        } else if (ctx.route === '/') {
          title = `${baseTitle} — Online Skin Analysis`
          desc = descLanding
          canonicalPath = '/'
        }

        const canonicalUrl = `${origin}${canonicalPath}`

        const replaceMeta = (html: string, pattern: RegExp, replacement: string) => {
          if (pattern.test(html)) return html.replace(pattern, replacement)
          return html
        }

        let html = ctx.html

        html = replaceMeta(html, /<title>[^<]*<\/title>/i, `<title>${title}</title>`)
        html = replaceMeta(
          html,
          /<meta\s+name="description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
          `<meta name="description" content="${desc}">`,
        )
        html = replaceMeta(
          html,
          /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
          `<link rel="canonical" href="${canonicalUrl}">`,
        )

        html = replaceMeta(
          html,
          /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
          `<meta property="og:title" content="${title}">`,
        )
        html = replaceMeta(
          html,
          /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
          `<meta property="og:description" content="${desc}">`,
        )
        html = replaceMeta(
          html,
          /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
          `<meta property="og:url" content="${canonicalUrl}">`,
        )

        html = replaceMeta(
          html,
          /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
          `<meta name="twitter:title" content="${title}">`,
        )
        html = replaceMeta(
          html,
          /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>(?:\s*)/i,
          `<meta name="twitter:description" content="${desc}">`,
        )

        ctx.html = html
        return ctx
      },
      renderer: new vitePrerender.PuppeteerRenderer({
        maxConcurrentRoutes: 1,
        navigationOptions: {
          waitUntil: 'domcontentloaded',
        },
        renderAfterTime: 1500,
      }),
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
    },
  },
})
