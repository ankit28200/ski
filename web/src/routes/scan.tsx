import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Download,
  ExternalLink,
  LineChart,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { DrawingUtils, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { analyzeSkin, doctorChat } from '../lib/api'
import { readBrandConfig, hexToRgb } from '../lib/brand'
import { loadCatalog } from '../lib/catalog'
import type { CatalogProduct } from '../lib/catalog'
import { cn } from '../lib/cn'
import { postEmbedEvent } from '../lib/embed'
import { buildRecommendations } from '../lib/recommend'
import type { RecommendationResult } from '../lib/recommend'
import { loadDoctorChat, saveDoctorChat, saveToHistory } from '../lib/storage'
import type { AnalysisAnswers, AnalysisResponse, ChatTurn, StoredAnalysis } from '../lib/types'

type Pose = 'front' | 'left' | 'right' | 'unknown'

type CaptureItem = {
  id: string
  blob: Blob
  url: string
  pose: Pose
}

function makeId() {
  return Math.random().toString(16).slice(2)
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function fitzpatrickMeaning(type: number): string {
  if (type === 1) return 'Very fair — always burns, never tans.'
  if (type === 2) return 'Fair — usually burns, tans minimally.'
  if (type === 3) return 'Medium — sometimes burns, gradually tans.'
  if (type === 4) return 'Olive/brown — rarely burns, tans easily.'
  if (type === 5) return 'Dark brown — very rarely burns, tans very easily.'
  if (type === 6) return 'Deeply pigmented — does not burn easily (in typical sun exposure).'
  return 'Phototype scale based on typical burn/tan response.'
}

function initialsFromProductName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? 'P'
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? ''
  return `${first}${second}`.toUpperCase()
}

function escapeSvgText(v: string): string {
  return v.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    if (ch === '"') return '&quot;'
    return '&#39;'
  })
}

function productFallbackImageDataUri(p: { brand?: string; name: string }): string {
  const initials = initialsFromProductName(p.name)
  const brand = escapeSvgText(p.brand ?? 'Product')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#334155"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)"/><text x="64" y="70" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="40" font-weight="700" fill="rgba(255,255,255,0.92)">${initials}</text><text x="64" y="98" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="12" font-weight="600" fill="rgba(255,255,255,0.72)">${brand}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function ProductThumb({ p }: { p: CatalogProduct }) {
  const [errored, setErrored] = useState(false)
  const src =
    !errored && p.imageUrl && p.imageUrl.trim().length > 0
      ? p.imageUrl
      : productFallbackImageDataUri({ brand: p.brand, name: p.name })

  return (
    <img
      src={src}
      alt={p.name}
      onError={() => setErrored(true)}
      loading="lazy"
      className="h-16 w-16 flex-none rounded-2xl object-cover bg-white/10"
    />
  )
}

function StepPill({
  active,
  done,
  label,
  n,
}: {
  active: boolean
  done: boolean
  label: string
  n: number
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
        active
          ? 'border-white/18 bg-white/10 text-white'
          : done
            ? 'border-white/10 bg-white/5 text-white/80'
            : 'border-white/10 bg-white/5 text-white/55',
      )}
    >
      <div
        className={cn(
          'grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold',
          active
            ? 'bg-white text-slate-900'
            : done
              ? 'bg-emerald-300 text-slate-900'
              : 'bg-white/10 text-white/70',
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <span>{label}</span>
    </div>
  )
}

function Button({
  variant,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  children: ReactNode
}) {
  const v = variant ?? 'primary'
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'

  const style =
    v === 'primary'
      ? 'bg-white text-slate-900 hover:bg-white/95'
      : v === 'danger'
        ? 'bg-rose-500/90 text-white hover:bg-rose-500'
        : v === 'secondary'
          ? 'border border-white/12 bg-white/5 text-white hover:bg-white/10'
          : 'text-white/80 hover:bg-white/10'

  return (
    <button {...props} className={cn(base, style, className)}>
      {children}
    </button>
  )
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl border px-3 py-2 text-sm transition',
        active
          ? 'border-white/10 text-white'
          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
      )}
      style={
        active
          ? {
              borderColor: 'rgba(var(--brand-primary-rgb),0.4)',
              backgroundColor: 'rgba(var(--brand-primary-rgb),0.1)',
            }
          : undefined
      }
    >
      {label}
    </button>
  )
}

function Gauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative grid h-36 w-36 place-items-center rounded-full border border-white/10 bg-white/5 shadow-glow">
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: `conic-gradient(rgba(var(--brand-primary-rgb),0.9) ${v * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
        }}
      />
      <div className="relative grid h-28 w-28 place-items-center rounded-full bg-ink-950">
        <div className="text-2xl font-semibold text-white">{Math.round(v)}</div>
        <div className="text-xs text-white/60">overall</div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  severity,
  confidence,
  summary,
  tips,
}: {
  label: string
  severity: number
  confidence: number
  summary: string
  tips: string[]
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="mt-1 text-xs text-white/60">
            Confidence: {(confidence * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold text-white">
          {Math.round(severity)}
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, severity))}%`,
            backgroundColor: 'rgb(var(--brand-primary-rgb))',
          }}
        />
      </div>

      <div className="mt-3 text-sm text-white/70">{summary}</div>

      <div className="mt-3 grid gap-2">
        {tips.slice(0, 3).map((t, i) => (
          <div key={i} className="text-sm text-white/70">
            {t}
          </div>
        ))}
      </div>
    </div>
  )
}

async function blobToThumb(blob: Blob): Promise<string | undefined> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      const url = URL.createObjectURL(blob)
      el.onload = () => {
        URL.revokeObjectURL(url)
        resolve(el)
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('image load failed'))
      }
      el.src = url
    })

    const maxW = 240
    const scale = Math.min(1, maxW / img.width)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.75)
  } catch {
    return undefined
  }
}

export default function ScanPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const brand = useMemo(() => readBrandConfig(location.search), [location.search])
  const primaryRgb = useMemo(() => {
    const fromHex = brand.primary ? hexToRgb(brand.primary) : undefined
    return fromHex ?? '56, 189, 248'
  }, [brand.primary])
  const accentRgb = useMemo(() => {
    const fromHex = brand.accent ? hexToRgb(brand.accent) : undefined
    return fromHex ?? '167, 139, 250'
  }, [brand.accent])

  const steps = ['Preparation', 'Scan', 'Questions', 'Results']
  const [step, setStep] = useState(0)

  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const capturesRef = useRef<CaptureItem[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const [meshStatus, setMeshStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [overlayFocus, setOverlayFocus] = useState<string>('top')
  const [resultImageTick, setResultImageTick] = useState(0)
  const [concernMapStatus, setConcernMapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  const [scanQuality, setScanQuality] = useState<{
    score: number
    brightness: number
    sharpness: number
    faceCoverage: number
    pose: 'front' | 'left' | 'right' | 'unknown'
    warnings: string[]
  }>({
    score: 0,
    brightness: 0,
    sharpness: 0,
    faceCoverage: 0,
    pose: 'unknown',
    warnings: [],
  })
  const [autoCapture, setAutoCapture] = useState(false)
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const stillLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const resultImageRef = useRef<HTMLImageElement | null>(null)
  const resultOverlayRef = useRef<HTMLCanvasElement | null>(null)

  const latestFaceRef = useRef<{ found: boolean; coverage: number; noseRatio: number }>(
    { found: false, coverage: 0, noseRatio: 0.5 },
  )
  const lastAutoCaptureAtRef = useRef(0)
  const lastCapturedPoseRef = useRef<'front' | 'left' | 'right' | 'unknown'>('unknown')

  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [sleep, setSleep] = useState('')
  const [stress, setStress] = useState('5')
  const [spf, setSpf] = useState('3')
  const [smoking, setSmoking] = useState(false)

  const [concerns, setConcerns] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null)
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)

  const [chatUserName, setChatUserName] = useState('')
  const [chatIncludePhoto, setChatIncludePhoto] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([])
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    postEmbedEvent('ready', { route: 'scan' }, brand)
  }, [brand])

  useEffect(() => {
    capturesRef.current = captures
  }, [captures])

  useEffect(() => {
    return () => {
      faceLandmarkerRef.current?.close()
      faceLandmarkerRef.current = null
      stillLandmarkerRef.current?.close()
      stillLandmarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!result) {
      setRecommendations(null)
      setRecommendationsLoading(false)
      return
    }

    let active = true
    setRecommendationsLoading(true)
    setRecommendations(null)

    loadCatalog({ catalogUrl: brand.catalogUrl, brandName: brand.name })
      .then((catalog: CatalogProduct[]) => {
        if (!active) return
        setRecommendations(buildRecommendations({ analysis: result, catalog, concerns, goals }))
      })
      .finally(() => {
        if (!active) return
        setRecommendationsLoading(false)
      })

    return () => {
      active = false
    }
  }, [brand.catalogUrl, brand.name, result])

  useEffect(() => {
    const video = videoRef.current

    if (!cameraOn) {
      if (video) {
        try {
          video.pause()
        } catch {}
        video.srcObject = null
      }
      return
    }

    const stream = streamRef.current
    if (!video || !stream) return

    video.srcObject = stream
    video.muted = true

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setError('Could not start camera preview. You can use upload instead.')
        setCameraOn(false)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      })
    }
  }, [cameraOn, step])

  useEffect(() => {
    if (!cameraOn) {
      setMeshStatus('idle')
      const canvas = overlayRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    let active = true
    let raf = 0

    async function init() {
      setMeshStatus('loading')
      try {
        if (!faceLandmarkerRef.current) {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
          )

          const modelAssetPath =
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

          try {
            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate: 'GPU' },
              runningMode: 'VIDEO',
              numFaces: 1,
            })
          } catch {
            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate: 'CPU' },
              runningMode: 'VIDEO',
              numFaces: 1,
            })
          }
        }
        setMeshStatus('ready')
      } catch {
        setMeshStatus('error')
        return
      }

      const video = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const drawingUtils = new DrawingUtils(ctx)
      let lastVideoTime = -1

      const probeCanvas = document.createElement('canvas')
      const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true })
      const heatCanvas = document.createElement('canvas')
      const heatCtx = heatCanvas.getContext('2d', { willReadFrequently: true })
      let heatData: ImageData | null = null
      let gray: Uint8Array | null = null
      let lastHeatAt = 0

      const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
      const parseRgb = (s: string) =>
        s.split(',').map((v) => {
          const n = Number(v.trim())
          return Number.isFinite(n) ? Math.round(n) : 0
        })
      const primary = parseRgb(primaryRgb)
      const accent = parseRgb(accentRgb)

      const computeLiveHeatmap = (vw: number, vh: number) => {
        if (!probeCtx || !heatCtx) return

        const targetW = 160
        const targetH = Math.max(1, Math.round((targetW * vh) / vw))
        if (probeCanvas.width !== targetW || probeCanvas.height !== targetH) {
          probeCanvas.width = targetW
          probeCanvas.height = targetH
          heatCanvas.width = targetW
          heatCanvas.height = targetH
          heatData = new ImageData(targetW, targetH)
          gray = new Uint8Array(targetW * targetH)
        }

        probeCtx.drawImage(video, 0, 0, probeCanvas.width, probeCanvas.height)

        let img: ImageData
        try {
          img = probeCtx.getImageData(0, 0, probeCanvas.width, probeCanvas.height)
        } catch {
          return
        }

        if (!heatData || !gray) return

        const d = img.data
        const out = heatData.data
        const w = probeCanvas.width
        const h = probeCanvas.height

        for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
          const r = d[i]
          const g = d[i + 1]
          const b = d[i + 2]
          gray[p] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
        }

        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const p = y * w + x
            const i = p * 4
            const r = d[i]
            const g = d[i + 1]
            const b = d[i + 2]

            const max = Math.max(r, g, b)
            const min = Math.min(r, g, b)
            const v = max / 255
            const s = max === 0 ? 0 : (max - min) / max

            let redness = clamp01((r - (g + b) / 2) / 80)
            redness *= 0.55 + 0.45 * v

            const shine = clamp01((v - 0.76) / 0.24) * clamp01((0.35 - s) / 0.35)

            let texture = 0
            if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
              const c = gray[p]
              const lap = Math.abs(-4 * c + gray[p - 1] + gray[p + 1] + gray[p - w] + gray[p + w])
              texture = clamp01(lap / 140)
            }

            let kind: 0 | 1 | 2 = 0
            let m = redness
            if (shine > m) {
              m = shine
              kind = 1
            }
            if (texture > m) {
              m = texture
              kind = 2
            }

            if (m < 0.12) {
              out[i] = 0
              out[i + 1] = 0
              out[i + 2] = 0
              out[i + 3] = 0
              continue
            }

            let rr = 148
            let gg = 163
            let bb = 184
            if (kind === 0) {
              rr = 244
              gg = 63
              bb = 94
            } else if (kind === 1) {
              rr = primary[0] ?? 56
              gg = primary[1] ?? 189
              bb = primary[2] ?? 248
            } else {
              rr = accent[0] ?? 167
              gg = accent[1] ?? 139
              bb = accent[2] ?? 250
            }

            out[i] = rr
            out[i + 1] = gg
            out[i + 2] = bb
            out[i + 3] = Math.round(255 * Math.min(0.55, Math.pow(m, 1.2) * 0.6))
          }
        }

        heatCtx.putImageData(heatData, 0, 0)
      }

      const render = () => {
        if (!active) return

        const landmarker = faceLandmarkerRef.current
        if (landmarker && video.readyState >= 2) {
          const vw = video.videoWidth
          const vh = video.videoHeight
          if (vw > 0 && vh > 0) {
            if (canvas.width !== vw || canvas.height !== vh) {
              canvas.width = vw
              canvas.height = vh
            }

            const t = video.currentTime
            if (t !== lastVideoTime) {
              lastVideoTime = t

              ctx.clearRect(0, 0, canvas.width, canvas.height)
              const now = performance.now()
              const res = landmarker.detectForVideo(video, now)

              const lm0 = res.faceLandmarks?.[0]
              if (lm0 && lm0.length > 0) {
                let minX = Infinity
                let minY = Infinity
                let maxX = -Infinity
                let maxY = -Infinity
                for (const p of lm0) {
                  const x = p.x * vw
                  const y = p.y * vh
                  if (x < minX) minX = x
                  if (y < minY) minY = y
                  if (x > maxX) maxX = x
                  if (y > maxY) maxY = y
                }

                const fw = Math.max(1, maxX - minX)
                const fh = Math.max(1, maxY - minY)
                const area = Math.max(0, fw * fh)
                const coverage = Math.max(0, Math.min(1, area / (vw * vh)))
                const nose = lm0[1]
                const noseX = nose ? nose.x * vw : (minX + maxX) / 2
                const noseRatio = Math.max(
                  0,
                  Math.min(1, (noseX - minX) / Math.max(1, maxX - minX)),
                )
                latestFaceRef.current = { found: true, coverage, noseRatio }

                if (now - lastHeatAt > 250) {
                  lastHeatAt = now
                  computeLiveHeatmap(vw, vh)
                }

                if (heatData && heatCanvas.width > 0 && heatCanvas.height > 0) {
                  const strength = Math.max(0, Math.min(1, (coverage - 0.06) / 0.14))
                  if (strength > 0) {
                    const cx = (minX + maxX) / 2
                    const cy = (minY + maxY) / 2

                    ctx.save()
                    ctx.beginPath()
                    ctx.ellipse(cx, cy, fw * 0.62, fh * 0.74, 0, 0, Math.PI * 2)
                    ctx.clip()
                    ctx.globalCompositeOperation = 'screen'
                    ctx.globalAlpha = 0.85 * strength
                    ctx.filter = 'blur(18px)'
                    ctx.drawImage(heatCanvas, 0, 0, vw, vh)
                    ctx.restore()
                  }
                }
              } else {
                latestFaceRef.current = { found: false, coverage: 0, noseRatio: 0.5 }
              }

              for (const lm of res.faceLandmarks) {
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                  color: `rgba(${primaryRgb},0.35)`,
                  lineWidth: 1,
                })
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
                  color: `rgba(${primaryRgb},0.95)`,
                  lineWidth: 2,
                })
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LIPS, {
                  color: 'rgba(244,63,94,0.95)',
                  lineWidth: 2,
                })
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
                  color: 'rgba(34,197,94,0.95)',
                  lineWidth: 2,
                })
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
                  color: 'rgba(34,197,94,0.95)',
                  lineWidth: 2,
                })
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
                  color: 'rgba(255,255,255,0.75)',
                  lineWidth: 2,
                })
                drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
                  color: 'rgba(255,255,255,0.75)',
                  lineWidth: 2,
                })
              }
            }
          }
        }

        raf = requestAnimationFrame(render)
      }

      raf = requestAnimationFrame(render)
    }

    init()

    return () => {
      active = false
      if (raf) cancelAnimationFrame(raf)

      const canvas = overlayRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [accentRgb, cameraOn, primaryRgb])

  useEffect(() => {
    return () => {
      capturesRef.current.forEach((c) => URL.revokeObjectURL(c.url))
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause()
        } catch {}
        videoRef.current.srcObject = null
      }
    }
  }, [])

  async function startCamera() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      setCameraOn(true)
    } catch {
      setError('Could not access camera. You can use upload instead.')
      setCameraOn(false)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {}
      videoRef.current.srcObject = null
    }
    setCameraOn(false)
  }

  async function captureFromCamera() {
    const video = videoRef.current
    if (!video) return

    const face = latestFaceRef.current
    const pose: Pose =
      face.found && face.coverage > 0
        ? face.noseRatio < 0.46
          ? 'left'
          : face.noseRatio > 0.54
            ? 'right'
            : 'front'
        : 'unknown'

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 720
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    )

    if (!blob) return

    const url = URL.createObjectURL(blob)
    lastCapturedPoseRef.current = pose
    setCaptures((prev) => [...prev, { id: makeId(), blob, url, pose }])
  }

  async function downloadConcernMap() {
    const img = resultImageRef.current
    const overlay = resultOverlayRef.current
    if (!img || !overlay) return
    if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return

    const out = document.createElement('canvas')
    out.width = overlay.width || img.naturalWidth
    out.height = overlay.height || img.naturalHeight
    const ctx = out.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0, out.width, out.height)
    ctx.drawImage(overlay, 0, 0, out.width, out.height)

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `skinsense-${result?.analysis_id ?? 'result'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1200)
  }

  function productMatchReason(p: CatalogProduct): string {
    if (!result) return ''

    const reasons: string[] = []
    if (p.skinTypes && p.skinTypes.includes(result.skin_type)) {
      reasons.push(`Good for ${result.skin_type}`)
    }

    const concernMatches = (p.concerns ?? []).filter((c) => recTopConcerns.includes(c))
    if (concernMatches.length > 0) {
      reasons.push(
        `Targets ${concernMatches
          .map((c) => metricLabelById[c] ?? c)
          .slice(0, 2)
          .join(', ')}`,
      )
    }

    const tagLabel: Record<string, string> = {
      niacinamide: 'Niacinamide',
      vitamin_c: 'Vitamin C',
      retinoid: 'Retinoid',
      bha: 'BHA',
      aha: 'AHA',
      azelaic_acid: 'Azelaic acid',
      panthenol: 'Panthenol',
      peptides: 'Peptides',
      caffeine: 'Caffeine',
      ceramides: 'Ceramides',
      hyaluronic_acid: 'Hyaluronic acid',
      tranexamic: 'Tranexamic',
    }

    const tagMatches = (p.tags ?? []).map((t) => tagLabel[t]).filter(Boolean)
    if (tagMatches.length > 0) {
      reasons.push(`Actives: ${tagMatches.slice(0, 2).join(', ')}`)
    }

    return reasons.join(' · ')
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    const next: CaptureItem[] = []
    for (const f of Array.from(files)) {
      const url = URL.createObjectURL(f)
      next.push({ id: makeId(), blob: f, url, pose: 'unknown' })
    }
    setCaptures((prev) => [...prev, ...next])
  }

  function removeCapture(id: string) {
    setCaptures((prev) => {
      const item = prev.find((x) => x.id === id)
      if (item) URL.revokeObjectURL(item.url)
      return prev.filter((x) => x.id !== id)
    })
  }

  function resetAll() {
    stopCamera()
    captures.forEach((c) => URL.revokeObjectURL(c.url))
    setCaptures([])
    setResult(null)
    setError(null)
    setLoading(false)
    setChatTurns([])
    setChatError(null)
    setChatInput('')
    setChatIncludePhoto(false)
    setStep(0)
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || !result || chatSending) return

    const analysisId = result.analysis_id
    const history = chatTurns
    const optimistic = [...history, { role: 'user', text }]
    setChatTurns(optimistic)
    saveDoctorChat(analysisId, optimistic)
    setChatInput('')

    setChatSending(true)
    setChatError(null)

    try {
      const res = await doctorChat({
        message: text,
        history,
        analysis: { ...result, heatmaps: null, debug: null },
        products: recommendations?.products ?? [],
        userName: chatUserName,
        image: chatIncludePhoto ? selectedCapture?.blob ?? null : null,
      })

      const finalTurns = [...optimistic, { role: 'model', text: res.reply }]
      setChatTurns(finalTurns)
      saveDoctorChat(analysisId, finalTurns)
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setChatSending(false)
    }
  }

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  }

  const canNext = useMemo(() => {
    if (step === 1) return captures.length > 0
    if (step === 3) return false
    return true
  }, [step, captures.length])

  const chartData = useMemo(() => {
    if (!result) return []
    return result.metrics
      .map((m) => ({ name: m.id.replace(/_/g, ' '), severity: Math.round(m.severity) }))
      .sort((a, b) => b.severity - a.severity)
  }, [result])

  const selectedCapture = useMemo(() => {
    if (!result) return null
    return captures[result.selected_image] ?? null
  }, [captures, result])

  const topConcernMetrics = useMemo(() => {
    if (!result) return []
    const sorted = [...result.metrics].sort((a, b) => b.severity - a.severity)
    const filtered = sorted.filter((m) => m.severity >= 12)
    const pick = filtered.length >= 3 ? filtered : sorted.slice(0, 3)
    return pick.slice(0, 6)
  }, [result])

  const recTopConcerns = useMemo(() => {
    if (!result) return []
    return [...result.metrics].sort((a, b) => b.severity - a.severity).slice(0, 3).map((m) => m.id)
  }, [result])

  const metricLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    if (!result) return out
    for (const m of result.metrics) {
      out[m.id] = m.label.replace(/\s*\(proxy\)\s*/i, '').trim()
    }
    return out
  }, [result])

  useEffect(() => {
    if (!result) return
    setOverlayFocus('top')
    setConcernMapStatus('idle')
    setChatTurns(loadDoctorChat(result.analysis_id))
    setChatError(null)
    setChatInput('')
    setChatIncludePhoto(false)
  }, [result?.analysis_id])

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
      raf2 = requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [chatTurns.length, chatSending])

  useEffect(() => {
    if (step !== 3 || !result) {
      setConcernMapStatus('idle')
      return
    }

    const img = resultImageRef.current
    const canvas = resultOverlayRef.current
    if (!img || !canvas) return
    if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return

    const imgEl = img
    const canvasEl = canvas
    const analysis = result

    let active = true

    async function ensureLandmarker() {
      if (stillLandmarkerRef.current) return stillLandmarkerRef.current

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      )

      const modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

      try {
        stillLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath, delegate: 'GPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
        })
      } catch {
        stillLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
        })
      }

      return stillLandmarkerRef.current
    }

    async function renderConcernMap() {
      setConcernMapStatus('loading')

      try {
        const landmarker = await ensureLandmarker()
        if (!active) return
        if (!landmarker) throw new Error('landmarker missing')

        const res = landmarker.detect(imgEl)
        if (!active) return

        const landmarks = res.faceLandmarks?.[0]
        const ctx = canvasEl.getContext('2d')
        if (!ctx) throw new Error('ctx missing')

        canvasEl.width = imgEl.naturalWidth
        canvasEl.height = imgEl.naturalHeight
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

        if (!landmarks || landmarks.length === 0) {
          setConcernMapStatus('error')
          return
        }

        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        let sumX = 0
        let sumY = 0

        for (const p of landmarks) {
          const x = p.x * canvasEl.width
          const y = p.y * canvasEl.height
          sumX += x
          sumY += y
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }

        const cx = sumX / landmarks.length
        const cy = sumY / landmarks.length
        const fw = Math.max(1, maxX - minX)
        const fh = Math.max(1, maxY - minY)

        const pt = (i: number, fallback: { x: number; y: number }) => {
          const p = landmarks[i]
          if (!p) return fallback
          return { x: p.x * canvasEl.width, y: p.y * canvasEl.height }
        }

        const forehead = pt(10, { x: cx, y: minY + fh * 0.18 })
        const nose = pt(1, { x: cx, y: minY + fh * 0.5 })
        const chin = pt(152, { x: cx, y: minY + fh * 0.88 })
        const leftCheek = pt(234, { x: minX + fw * 0.32, y: minY + fh * 0.62 })
        const rightCheek = pt(454, { x: minX + fw * 0.68, y: minY + fh * 0.62 })
        const leftUnderEye = pt(159, { x: minX + fw * 0.35, y: minY + fh * 0.44 })
        const rightUnderEye = pt(386, { x: minX + fw * 0.65, y: minY + fh * 0.44 })
        const leftEyeOuter = pt(33, { x: minX + fw * 0.25, y: minY + fh * 0.42 })
        const rightEyeOuter = pt(263, { x: minX + fw * 0.75, y: minY + fh * 0.42 })

        const meta: Record<string, { severity: number; confidence: number; label: string }> = {}
        for (const m of analysis.metrics) {
          meta[m.id] = {
            severity: m.severity,
            confidence: m.confidence,
            label: m.label.replace(/\s*\(proxy\)\s*/i, '').trim(),
          }
        }

        const rgba = (rgb: string, a: number) => `rgba(${rgb},${Math.max(0, Math.min(a, 1))})`

        const metricColor = (id: string) => {
          if (id === 'oiliness') return primaryRgb
          if (id === 'texture') return accentRgb
          if (id === 'redness') return '244, 63, 94'
          if (id === 'uneven_tone') return '245, 158, 11'
          if (id === 'puffy_eyes') return '34, 197, 94'
          if (id === 'wrinkles') return '249, 115, 22'
          return '148, 163, 184'
        }

        const avg2 = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        })

        const metricWeight = (id: string) => {
          const m = meta[id]
          if (!m) return 0
          const s = Math.max(0, Math.min(1, m.severity / 100))
          const c = Math.max(0, Math.min(1, m.confidence))
          return Math.pow(s * c, 0.7)
        }

        const activeMetricIds =
          overlayFocus === 'top'
            ? topConcernMetrics.map((m) => m.id)
            : overlayFocus
              ? [overlayFocus]
              : []

        const shouldDraw = (id: string) => activeMetricIds.includes(id)

        const loadImg = (src: string) =>
          new Promise<HTMLImageElement | null>((resolve) => {
            const im = new Image()
            im.onload = () => resolve(im)
            im.onerror = () => resolve(null)
            im.src = src
          })

        const heatmapEntries = await Promise.all(
          activeMetricIds.map(async (id) => {
            const src = analysis.heatmaps?.[id]
            if (!src) return { id, img: null as HTMLImageElement | null }
            const img = await loadImg(src)
            return { id, img }
          }),
        )
        if (!active) return

        const heatmapIds = new Set<string>()
        for (const e of heatmapEntries) {
          if (e.img) heatmapIds.add(e.id)
        }

        const spot = (p: { x: number; y: number }, r: number, rgb: string, alpha: number) => {
          if (alpha <= 0) return
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
          g.addColorStop(0, `rgba(${rgb},${Math.max(0, Math.min(alpha, 0.85))})`)
          g.addColorStop(1, `rgba(${rgb},0)`)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.save()
        ctx.beginPath()
        ctx.ellipse(cx, cy, fw * 0.62, fh * 0.74, 0, 0, Math.PI * 2)
        ctx.clip()
        ctx.globalCompositeOperation = 'screen'
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        if (heatmapIds.size > 0) {
          ctx.filter = 'none'
          for (const e of heatmapEntries) {
            if (!e.img) continue
            const w = metricWeight(e.id)
            const a = Math.max(0, Math.min(1, 0.3 + 0.7 * w))
            ctx.globalAlpha = a
            ctx.drawImage(e.img, 0, 0, canvasEl.width, canvasEl.height)
          }
        }

        ctx.globalAlpha = 1
        ctx.filter = 'blur(14px)'

        if (shouldDraw('oiliness') && !heatmapIds.has('oiliness')) {
          const w = metricWeight('oiliness')
          const r = fw * (0.14 + 0.06 * w)
          const rgb = metricColor('oiliness')
          spot(forehead, r * 1.15, rgb, 0.42 * w)
          spot(nose, r * 0.95, rgb, 0.5 * w)
          spot(chin, r * 1.05, rgb, 0.38 * w)
        }

        if (shouldDraw('redness') && !heatmapIds.has('redness')) {
          const w = metricWeight('redness')
          const r = fw * (0.16 + 0.06 * w)
          const rgb = metricColor('redness')
          spot(leftCheek, r, rgb, 0.58 * w)
          spot(rightCheek, r, rgb, 0.58 * w)
        }

        if (shouldDraw('uneven_tone') && !heatmapIds.has('uneven_tone')) {
          const w = metricWeight('uneven_tone')
          const r = fw * (0.18 + 0.06 * w)
          const rgb = metricColor('uneven_tone')
          spot(forehead, r * 0.9, rgb, 0.34 * w)
          spot(leftCheek, r, rgb, 0.38 * w)
          spot(rightCheek, r, rgb, 0.38 * w)
        }

        if (shouldDraw('texture') && !heatmapIds.has('texture')) {
          const w = metricWeight('texture')
          const r = fw * (0.16 + 0.06 * w)
          const rgb = metricColor('texture')
          spot(nose, r * 0.95, rgb, 0.48 * w)
          spot(leftCheek, r * 0.9, rgb, 0.36 * w)
          spot(rightCheek, r * 0.9, rgb, 0.36 * w)
        }

        if (shouldDraw('puffy_eyes')) {
          const w = metricWeight('puffy_eyes')
          const r = fw * (0.12 + 0.04 * w)
          const rgb = metricColor('puffy_eyes')
          spot(leftUnderEye, r, rgb, 0.56 * w)
          spot(rightUnderEye, r, rgb, 0.56 * w)
        }

        if (shouldDraw('wrinkles') && !heatmapIds.has('wrinkles')) {
          const w = metricWeight('wrinkles')
          const r = fw * (0.16 + 0.06 * w)
          const rgb = metricColor('wrinkles')
          spot(forehead, r * 1.05, rgb, 0.36 * w)
          spot(leftEyeOuter, r * 0.65, rgb, 0.5 * w)
          spot(rightEyeOuter, r * 0.65, rgb, 0.5 * w)
        }

        ctx.restore()

        const hmCanvas = document.createElement('canvas')
        const hmCtx = hmCanvas.getContext('2d', { willReadFrequently: true })
        const heatmapAnchorCache: Record<string, { x: number; y: number }> = {}

        const heatmapAnchor = (id: string): { x: number; y: number } | null => {
          if (heatmapAnchorCache[id]) return heatmapAnchorCache[id]
          if (!hmCtx) return null
          const entry = heatmapEntries.find((e) => e.id === id)
          if (!entry?.img) return null

          const srcImg = entry.img
          const tw = 160
          const th = Math.max(1, Math.round((tw * srcImg.height) / Math.max(1, srcImg.width)))

          hmCanvas.width = tw
          hmCanvas.height = th
          hmCtx.clearRect(0, 0, tw, th)
          hmCtx.drawImage(srcImg, 0, 0, tw, th)

          let img: ImageData
          try {
            img = hmCtx.getImageData(0, 0, tw, th)
          } catch {
            return null
          }

          const data = img.data
          let maxA = 0
          for (let i = 3; i < data.length; i += 4) {
            const a = data[i]
            if (a > maxA) maxA = a
          }
          if (maxA <= 0) return null

          const centroid = (minA: number): { x: number; y: number } | null => {
            let sum = 0
            let sumX = 0
            let sumY = 0
            const step = 2
            for (let y = 0; y < th; y += step) {
              for (let x = 0; x < tw; x += step) {
                const idx = (y * tw + x) * 4 + 3
                const a = data[idx]
                if (a < minA) continue
                const w = a
                sum += w
                sumX += (x + 0.5) * w
                sumY += (y + 0.5) * w
              }
            }
            if (sum <= 0) return null
            return { x: sumX / sum, y: sumY / sum }
          }

          const thresh = Math.max(40, Math.round(maxA * 0.55))
          const c = centroid(thresh) ?? centroid(1)
          if (!c) return null

          const out = {
            x: Math.max(0, Math.min(canvasEl.width, (c.x / tw) * canvasEl.width)),
            y: Math.max(0, Math.min(canvasEl.height, (c.y / th) * canvasEl.height)),
          }
          heatmapAnchorCache[id] = out
          return out
        }

        const metricAnchor = (id: string) => {
          const hm = heatmapAnchor(id)
          if (hm) return hm
          if (id === 'oiliness') return nose
          if (id === 'redness') return avg2(leftCheek, rightCheek)
          if (id === 'uneven_tone') return forehead
          if (id === 'texture') return avg2(nose, rightCheek)
          if (id === 'puffy_eyes') return avg2(leftUnderEye, rightUnderEye)
          if (id === 'wrinkles') return avg2(forehead, avg2(leftEyeOuter, rightEyeOuter))
          return { x: cx, y: cy }
        }

        const calloutItems = activeMetricIds
          .map((id) => {
            const m = meta[id]
            if (!m) return null
            const w = metricWeight(id)
            if (w <= 0) return null
            const sev = Math.round(m.severity)
            const text = `${m.label}: ${sev}`
            return { id, anchor: metricAnchor(id), text, rgb: metricColor(id), w }
          })
          .filter(
            (v): v is { id: string; anchor: { x: number; y: number }; text: string; rgb: string; w: number } =>
              v !== null,
          )

        if (calloutItems.length > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'source-over'
          ctx.filter = 'none'
          ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'

          const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            const rr = Math.max(0, Math.min(r, w / 2, h / 2))
            ctx.beginPath()
            ctx.moveTo(x + rr, y)
            ctx.arcTo(x + w, y, x + w, y + h, rr)
            ctx.arcTo(x + w, y + h, x, y + h, rr)
            ctx.arcTo(x, y + h, x, y, rr)
            ctx.arcTo(x, y, x + w, y, rr)
            ctx.closePath()
          }

          const pad = 10
          const boxH = 28
          const gap = 8
          const maxBoxW = Math.min(280, Math.max(160, fw * 0.44))
          const margin = 10
          const colOffset = Math.max(14, fw * 0.06)

          const left: typeof calloutItems = []
          const right: typeof calloutItems = []
          for (const c of calloutItems) {
            const centered = Math.abs(c.anchor.x - cx) < fw * 0.08
            const side = centered ? (left.length <= right.length ? 'left' : 'right') : c.anchor.x < cx ? 'left' : 'right'
            if (side === 'left') left.push(c)
            else right.push(c)
          }

          left.sort((a, b) => a.anchor.y - b.anchor.y)
          right.sort((a, b) => a.anchor.y - b.anchor.y)

          const drawCallout = (
            c: { id: string; anchor: { x: number; y: number }; text: string; rgb: string; w: number },
            bx: number,
            by: number,
            bw: number,
            side: 'left' | 'right',
          ) => {
            const yMid = by + boxH / 2
            const endX = side === 'left' ? bx + bw : bx

            const a = Math.max(0.42, Math.min(0.92, 0.45 + 0.55 * c.w))
            ctx.lineWidth = 2
            ctx.strokeStyle = rgba(c.rgb, a)
            ctx.beginPath()
            ctx.moveTo(c.anchor.x, c.anchor.y)
            ctx.lineTo(endX, yMid)
            ctx.stroke()

            ctx.fillStyle = rgba(c.rgb, a)
            ctx.beginPath()
            ctx.arc(c.anchor.x, c.anchor.y, 3.5, 0, Math.PI * 2)
            ctx.fill()

            roundedRect(bx, by, bw, boxH, 10)
            ctx.fillStyle = 'rgba(2,6,23,0.72)'
            ctx.fill()
            ctx.strokeStyle = rgba(c.rgb, a)
            ctx.lineWidth = 1
            ctx.stroke()

            ctx.fillStyle = rgba(c.rgb, a)
            ctx.beginPath()
            ctx.arc(bx + 12, yMid, 4, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = 'rgba(255,255,255,0.92)'
            ctx.fillText(c.text, bx + 22, yMid)
          }

          const placeColumn = (items: typeof calloutItems, side: 'left' | 'right') => {
            let lastY = -Infinity
            for (const c of items) {
              const tw = ctx.measureText(c.text).width
              const bw = Math.max(140, Math.min(maxBoxW, tw + 22 + pad))

              const bxRaw =
                side === 'left' ? minX - bw - colOffset : maxX + colOffset
              const bx = Math.max(margin, Math.min(canvasEl.width - bw - margin, bxRaw))

              let by = c.anchor.y - boxH / 2
              by = Math.max(margin, Math.min(canvasEl.height - boxH - margin, by))
              if (by <= lastY + boxH + gap) by = lastY + boxH + gap
              if (by > canvasEl.height - boxH - margin) by = canvasEl.height - boxH - margin
              lastY = by

              drawCallout(c, bx, by, bw, side)
            }
          }

          placeColumn(left, 'left')
          placeColumn(right, 'right')

          ctx.restore()
        }

        setConcernMapStatus('ready')
      } catch {
        if (!active) return
        setConcernMapStatus('error')
      }
    }

    renderConcernMap()

    return () => {
      active = false
    }
  }, [accentRgb, overlayFocus, primaryRgb, result, resultImageTick, step, topConcernMetrics])

  useEffect(() => {
    if (!cameraOn || step !== 1) {
      setScanQuality({
        score: 0,
        brightness: 0,
        sharpness: 0,
        faceCoverage: 0,
        pose: 'unknown',
        warnings: [],
      })
      setAutoCountdown(null)
      return
    }

    let active = true
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const interval = window.setInterval(() => {
      if (!active) return
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      const vw = video.videoWidth
      const vh = video.videoHeight
      if (vw <= 0 || vh <= 0) return

      const targetW = 160
      const targetH = Math.max(1, Math.round((targetW * vh) / vw))
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      } catch {
        return
      }

      const w = canvas.width
      const h = canvas.height
      const gray = new Uint8Array(w * h)
      let sum = 0

      for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
        sum += y
        gray[p] = y
      }

      const brightness = Math.max(0, Math.min(1, sum / (w * h * 255)))

      let n = 0
      let mean = 0
      let m2 = 0
      for (let yy = 1; yy < h - 1; yy += 1) {
        for (let xx = 1; xx < w - 1; xx += 1) {
          const idx = yy * w + xx
          const c = gray[idx]
          const lap =
            -8 * c +
            gray[idx - 1] +
            gray[idx + 1] +
            gray[idx - w] +
            gray[idx + w] +
            gray[idx - w - 1] +
            gray[idx - w + 1] +
            gray[idx + w - 1] +
            gray[idx + w + 1]
          n += 1
          const delta = lap - mean
          mean += delta / n
          const delta2 = lap - mean
          m2 += delta * delta2
        }
      }

      const variance = n > 1 ? m2 / (n - 1) : 0
      const sharpness = Math.max(0, Math.min(1, variance / 800))

      const face = latestFaceRef.current
      const faceCoverage = face.coverage
      const pose =
        face.found && faceCoverage > 0
          ? face.noseRatio < 0.46
            ? 'left'
            : face.noseRatio > 0.54
              ? 'right'
              : 'front'
          : 'unknown'

      const brightCentered = Math.max(0, Math.min(1, 1 - Math.abs(brightness - 0.55) / 0.55))
      const sizeScore = Math.min(1, faceCoverage / 0.2)
      const score = face.found ? 0.45 * sharpness + 0.35 * brightCentered + 0.2 * sizeScore : 0

      const warnings: string[] = []
      if (brightness < 0.25) warnings.push('Lighting is low — move to brighter, even light.')
      if (brightness > 0.88) warnings.push('Lighting is very strong — avoid overexposure.')
      if (sharpness < 0.25) warnings.push('Hold still — image looks soft/blurry.')
      if (!face.found) warnings.push('No face detected — keep full face in frame.')
      if (face.found && faceCoverage < 0.08) warnings.push('Move closer — face is too small in frame.')

      setScanQuality({ score, brightness, sharpness, faceCoverage, pose, warnings })
    }, 450)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [cameraOn, step])

  useEffect(() => {
    if (!autoCapture || !cameraOn || step !== 1) {
      setAutoCountdown(null)
      return
    }

    if (captures.length >= 3) {
      setAutoCountdown(null)
      return
    }

    const good = scanQuality.score >= 0.78 && scanQuality.warnings.length === 0
    if (!good) {
      setAutoCountdown(null)
      return
    }

    if (scanQuality.pose !== 'unknown' && scanQuality.pose === lastCapturedPoseRef.current) {
      setAutoCountdown(null)
      return
    }

    if (autoCountdown === null && Date.now() - lastAutoCaptureAtRef.current > 2500) {
      setAutoCountdown(3)
    }
  }, [autoCapture, autoCountdown, cameraOn, captures.length, scanQuality.score, scanQuality.warnings, step])

  useEffect(() => {
    if (autoCountdown === null) return
    if (autoCountdown <= 0) return

    const t = window.setTimeout(() => {
      setAutoCountdown((v) => (v === null ? null : v - 1))
    }, 1000)

    return () => {
      window.clearTimeout(t)
    }
  }, [autoCountdown])

  useEffect(() => {
    if (autoCountdown !== 0) return

    if (!autoCapture || !cameraOn || step !== 1 || captures.length >= 3) {
      setAutoCountdown(null)
      return
    }

    const good = scanQuality.score >= 0.78 && scanQuality.warnings.length === 0
    if (!good) {
      setAutoCountdown(null)
      return
    }

    if (scanQuality.pose !== 'unknown' && scanQuality.pose === lastCapturedPoseRef.current) {
      setAutoCountdown(null)
      return
    }

    lastAutoCaptureAtRef.current = Date.now()
    setAutoCountdown(null)
    captureFromCamera()
  }, [
    autoCapture,
    autoCountdown,
    cameraOn,
    captures.length,
    scanQuality.pose,
    scanQuality.score,
    scanQuality.warnings,
    step,
  ])

  async function runAnalysis() {
    setLoading(true)
    setError(null)
    setResult(null)
    setChatTurns([])
    setChatError(null)
    setChatInput('')
    setChatIncludePhoto(false)
    postEmbedEvent('analysis_started', { images: captures.length }, brand)

    const answers: AnalysisAnswers = {
      age: age ? Number(age) : null,
      sex: sex || null,
      concerns,
      goals,
      lifestyle: {
        sleep_hours: sleep ? Number(sleep) : null,
        stress_level: stress ? Number(stress) : null,
        sunscreen_days_per_week: spf ? Number(spf) : null,
        smoking,
      },
    }

    try {
      const res = await analyzeSkin({
        images: captures.map((c) => c.blob),
        answers,
      })
      setResult(res)
      postEmbedEvent(
        'analysis_completed',
        {
          analysis_id: res.analysis_id,
          skin_type: res.skin_type,
          overall_score: res.overall_score,
        },
        brand,
      )

      const selected = captures[res.selected_image]
      const thumb = selected ? await blobToThumb(selected.blob) : undefined

      const entry: StoredAnalysis = {
        id: res.analysis_id,
        createdAt: new Date().toISOString(),
        thumb,
        response: res,
      }

      saveToHistory(entry)
      setStep(3)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unexpected error'
      setError(message)
      setStep(3)
      postEmbedEvent('analysis_failed', { message }, brand)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold text-white">Skin Analysis</div>
          <div className="mt-2 text-sm text-white/70">
            Multi-step flow for better scan quality and more reliable results.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {steps.map((label, idx) => (
            <StepPill
              key={label}
              n={idx + 1}
              label={label}
              active={step === idx}
              done={step > idx}
            />
          ))}
        </div>
      </div>

      <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
        {step === 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles
                  className="h-4 w-4"
                  style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                />
                Preparation checklist
              </div>
              <div className="mt-3 grid gap-3 text-sm text-white/70">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--brand-primary-rgb))' }}
                  />
                  Use balanced, even lighting (avoid harsh shadows)
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--brand-primary-rgb))' }}
                  />
                  Avoid heavy makeup; remove glasses
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--brand-primary-rgb))' }}
                  />
                  Hold still; camera at eye level; include full face
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white">Tip</div>
                <div className="mt-2 text-sm text-white/70">
                  Capture 1–3 photos (front + slight left + slight right). The backend chooses the best frame.
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white">Ready?</div>
              <div className="mt-2 text-sm text-white/70">
                Start the scan when you’re in good lighting.
              </div>
              <div className="mt-6">
                <Button onClick={() => setStep(1)}>
                  Start scan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-white">Capture photos</div>
              <div className="mt-2 text-sm text-white/70">
                Use camera or upload. You can mix both.
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {!cameraOn ? (
                  <Button variant="secondary" onClick={startCamera}>
                    <Camera className="h-4 w-4" />
                    Start camera
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={captureFromCamera}>
                      <Sparkles className="h-4 w-4" />
                      Capture
                    </Button>
                    <Button variant="ghost" onClick={stopCamera}>
                      Stop
                    </Button>
                  </>
                )}

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>

                {captures.length > 0 && (
                  <Button
                    variant="danger"
                    className="px-3 py-3"
                    onClick={() => {
                      captures.forEach((c) => URL.revokeObjectURL(c.url))
                      setCaptures([])
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>

              {cameraOn && (
                <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-black">
                  <div className="relative">
                    <video ref={videoRef} className="h-auto w-full" playsInline muted autoPlay />
                    <canvas
                      ref={overlayRef}
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />

                    {autoCountdown !== null ? (
                      <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-semibold text-white">
                        Auto-capture in {autoCountdown}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 px-4 pb-4 pt-3">
                    <div className="text-xs text-white/70">
                      Face overlay: {meshStatus === 'ready' ? 'on' : meshStatus}
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold tracking-wide text-white/70">LIVE SCAN COACH</div>
                        <label className="inline-flex items-center gap-2 text-xs text-white/70">
                          <input
                            type="checkbox"
                            checked={autoCapture}
                            onChange={(e) => setAutoCapture(e.target.checked)}
                            className="h-4 w-4"
                          />
                          Auto-capture
                        </label>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Quality</span>
                          <span>{Math.round(scanQuality.score * 100)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, scanQuality.score * 100))}%`,
                              backgroundColor:
                                scanQuality.score >= 0.78 && scanQuality.warnings.length === 0
                                  ? 'rgba(34,197,94,0.9)'
                                  : scanQuality.score >= 0.6
                                    ? 'rgba(250,204,21,0.9)'
                                    : 'rgba(244,63,94,0.9)',
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/60">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          Bright: {Math.round(scanQuality.brightness * 100)}%
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          Sharp: {Math.round(scanQuality.sharpness * 100)}%
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          Pose: {scanQuality.pose}
                        </div>
                      </div>

                      {scanQuality.warnings.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {scanQuality.warnings.slice(0, 2).map((w) => (
                            <div key={w} className="text-xs text-white/60">
                              {w}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-white/60">
                          Looks good — capture front, then turn slightly left/right.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-white">
                Selected images ({captures.length})
              </div>

              {captures.length === 0 ? (
                <div className="mt-4 rounded-[2rem] border border-white/10 bg-white/5 p-10 text-sm text-white/70">
                  Add at least one image to continue.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {captures.map((c) => (
                    <div
                      key={c.id}
                      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                    >
                      <img src={c.url} className="h-28 w-full object-cover" alt="capture" />

                      {c.pose !== 'unknown' ? (
                        <div className="absolute bottom-2 left-2 rounded-xl border border-white/10 bg-black/50 px-2 py-1 text-[11px] font-semibold text-white/80">
                          {c.pose}
                        </div>
                      ) : null}

                      <button
                        onClick={() => removeCapture(c.id)}
                        className="absolute right-2 top-2 rounded-xl bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white">Pro tip</div>
                <div className="mt-2 text-sm text-white/70">
                  If you have strong shadows on one side of your face, try turning slightly toward your light source.
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-white">Questions</div>
              <div className="mt-2 text-sm text-white/70">
                Optional, but helps personalize the routine and skin-age estimation.
              </div>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold tracking-wide text-white/70">Age (optional)</span>
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    inputMode="numeric"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold tracking-wide text-white/70">Sex (optional)</span>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold tracking-wide text-white/70">Lifestyle</div>

                  <label className="grid gap-2">
                    <span className="text-xs text-white/60">Sleep hours</span>
                    <input
                      value={sleep}
                      onChange={(e) => setSleep(e.target.value)}
                      inputMode="decimal"
                      placeholder="7.5"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs text-white/60">Stress level (0–10)</span>
                    <input
                      value={stress}
                      onChange={(e) => setStress(e.target.value)}
                      inputMode="numeric"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs text-white/60">Sunscreen days/week (0–7)</span>
                    <input
                      value={spf}
                      onChange={(e) => setSpf(e.target.value)}
                      inputMode="numeric"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="inline-flex items-center gap-3 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={smoking}
                      onChange={(e) => setSmoking(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Smoking
                  </label>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white">Concerns & goals</div>
              <div className="mt-2 text-sm text-white/70">
                Pick what matters to you.
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold tracking-wide text-white/70">Concerns</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'Acne',
                      'Dark spots',
                      'Redness',
                      'Texture',
                      'Oiliness',
                      'Dryness',
                      'Fine lines',
                    ].map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        active={concerns.includes(c.toLowerCase())}
                        onClick={() => toggle(concerns, setConcerns, c.toLowerCase())}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold tracking-wide text-white/70">Goals</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'Glow',
                      'Calm irritation',
                      'Even tone',
                      'Clear pores',
                      'Anti-aging',
                      'Hydration',
                    ].map((g) => (
                      <Chip
                        key={g}
                        label={g}
                        active={goals.includes(g.toLowerCase())}
                        onClick={() => toggle(goals, setGoals, g.toLowerCase())}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-sm font-semibold text-white">Run analysis</div>
                  <div className="mt-2 text-sm text-white/70">
                    We’ll pick the best photo and generate your dashboard.
                  </div>
                  <div className="mt-5">
                    <Button onClick={runAnalysis} disabled={captures.length === 0 || loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Analyze now
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-8">
            {loading && (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10">
                <div className="flex items-center gap-3 text-sm font-semibold text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-[2rem] border border-rose-500/30 bg-rose-500/10 p-8">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-100">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Retake scan
                  </Button>
                  <Button variant="ghost" onClick={resetAll}>
                    <RefreshCcw className="h-4 w-4" />
                    Start over
                  </Button>
                </div>
              </div>
            )}

            {!loading && result && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold tracking-wide text-white/70">
                        YOUR DASHBOARD
                      </div>
                      <div className="mt-2 text-xl font-semibold text-white">
                        {result.skin_type}
                      </div>
                      <div className="mt-1 text-sm text-white/70">
                        Quality: {(result.quality.score * 100).toFixed(0)}%
                      </div>
                    </div>
                    <Gauge value={result.overall_score} />
                  </div>

                  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">Capture quality</div>
                      <div className="text-xs text-white/60">
                        {(result.quality.score * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Lighting</span>
                          <span>{Math.round(result.quality.brightness * 100)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, result.quality.brightness * 100))}%`,
                              backgroundColor: 'rgba(var(--brand-primary-rgb),0.85)',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Sharpness</span>
                          <span>{Math.round(result.quality.blur * 100)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, result.quality.blur * 100))}%`,
                              backgroundColor: 'rgba(var(--brand-accent-rgb),0.85)',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Framing</span>
                          <span>{Math.round(result.quality.face_coverage * 100)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, result.quality.face_coverage * 100))}%`,
                              backgroundColor: 'rgba(34,197,94,0.85)',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {result.quality.warnings.length > 0 ? (
                      <div className="mt-4 grid gap-2 text-xs text-white/60">
                        {result.quality.warnings.slice(0, 3).map((w, i) => (
                          <div key={i}>{w}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-white/60">Great capture quality.</div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-3">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <div className="text-xs text-white/60">Fitzpatrick estimate</div>
                      <div className="mt-2 text-base font-semibold text-white">
                        {result.estimated_fitzpatrick ? `Type ${result.estimated_fitzpatrick}` : '—'}
                      </div>
                      <div className="mt-2 text-xs text-white/60">
                        {result.estimated_fitzpatrick
                          ? fitzpatrickMeaning(result.estimated_fitzpatrick)
                          : 'Estimated from the photo; lighting can affect accuracy.'}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <div className="text-xs text-white/60">Skin age estimate</div>
                      <div className="mt-2 text-base font-semibold text-white">
                        {result.skin_age !== null && result.skin_age !== undefined
                          ? `${result.skin_age.toFixed(1)} yrs`
                          : '—'}
                        {result.skin_age_delta !== null && result.skin_age_delta !== undefined ? (
                          <span className="ml-2 text-sm text-white/60">
                            ({result.skin_age_delta >= 0 ? '+' : ''}
                            {result.skin_age_delta.toFixed(1)})
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-white/60">
                        {result.skin_age !== null && result.skin_age !== undefined
                          ? 'Compared to your entered age; delta is driven by wrinkles, tone and redness.'
                          : 'Enter your age in Step 2 to enable this estimate.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-white">Notes</div>
                    <div className="mt-2 grid gap-2 text-sm text-white/70">
                      {result.notes.map((n, i) => (
                        <div key={i}>{n}</div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4" />
                      Retake
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/progress${location.search}`)}
                    >
                      <LineChart className="h-4 w-4" />
                      View progress
                    </Button>
                    <Button variant="ghost" onClick={resetAll}>
                      <RefreshCcw className="h-4 w-4" />
                      Start over
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 lg:col-span-2">
                  {selectedCapture ? (
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">AI concern map</div>
                          <div className="mt-2 text-sm text-white/70">
                            Visual overlay of likely concern regions (non-medical). Tap a concern to focus.
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Chip
                            label="Top concerns"
                            active={overlayFocus === 'top'}
                            onClick={() => setOverlayFocus('top')}
                          />
                          {topConcernMetrics.map((m) => (
                            <Chip
                              key={m.id}
                              label={m.label.replace(/\s*\(proxy\)\s*/i, '').trim()}
                              active={overlayFocus === m.id}
                              onClick={() => setOverlayFocus(m.id)}
                            />
                          ))}

                          <Button
                            variant="secondary"
                            className="px-3 py-2"
                            onClick={downloadConcernMap}
                            disabled={concernMapStatus !== 'ready'}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-black">
                        <div className="relative">
                          <img
                            ref={resultImageRef}
                            src={selectedCapture.url}
                            onLoad={() => setResultImageTick((v) => v + 1)}
                            className="h-auto w-full"
                            alt="Selected frame"
                          />
                          <canvas
                            ref={resultOverlayRef}
                            className="pointer-events-none absolute inset-0 h-full w-full"
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-white/60">
                        Overlay status: {concernMapStatus === 'ready' ? 'on' : concernMapStatus}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                    <div className="text-sm font-semibold text-white">Severity breakdown</div>
                    <div className="mt-3 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ left: 0, right: 12, top: 10, bottom: 10 }}
                        >
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                          />
                          <YAxis
                            tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'rgba(2,6,23,0.95)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: 16,
                            }}
                            labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                            itemStyle={{ color: 'white' }}
                          />
                          <Bar
                            dataKey="severity"
                            fill={`rgba(${primaryRgb},0.75)`}
                            radius={[10, 10, 10, 10]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {result.metrics.map((m) => (
                      <MetricCard
                        key={m.id}
                        label={m.label}
                        severity={m.severity}
                        confidence={m.confidence}
                        summary={m.summary}
                        tips={m.tips}
                      />
                    ))}
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                    <div className="text-sm font-semibold text-white">Suggested routine</div>
                    <div className="mt-2 text-sm text-white/70">
                      A simple starting point you can adjust based on tolerance.
                    </div>

                    {result.routine.length === 0 ? (
                      <div className="mt-4 text-sm text-white/70">
                        No routine generated.
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3">
                        {result.routine.map((r, idx) => (
                          <div
                            key={idx}
                            className="rounded-3xl border border-white/10 bg-white/5 p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-xs font-semibold tracking-wide text-white/70">
                                  {r.time}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                  {r.step}
                                </div>
                                <div className="mt-2 text-sm text-white/70">{r.why}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                      <div className="text-sm font-semibold text-white">Recommended ingredients</div>
                      <div className="mt-2 text-sm text-white/70">
                        Based on your scan plus the concerns and goals you selected.
                      </div>

                      {recommendationsLoading ? (
                        <div className="mt-4 text-sm text-white/70">Loading…</div>
                      ) : recommendations && recommendations.ingredients.length > 0 ? (
                        <div className="mt-4 grid gap-3">
                          {recommendations.ingredients.map((ing) => (
                            <div
                              key={ing.id}
                              className="rounded-3xl border border-white/10 bg-white/5 p-5"
                            >
                              <div className="text-sm font-semibold text-white">{ing.name}</div>
                              <div className="mt-2 text-sm text-white/70">{ing.why}</div>
                              {ing.caution ? (
                                <div className="mt-2 text-xs text-white/55">{ing.caution}</div>
                              ) : null}
                              {ing.links && ing.links.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {ing.links.map((lnk) => (
                                    <a
                                      key={lnk.url}
                                      href={lnk.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/7"
                                    >
                                      {lnk.label}
                                      <ExternalLink className="h-3.5 w-3.5 opacity-70 transition group-hover:opacity-100" />
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-white/70">No ingredient recommendations.</div>
                      )}
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                      <div className="text-sm font-semibold text-white">Shop products</div>
                      <div className="mt-2 text-sm text-white/70">
                        Suggested matches from {brand.name}.
                      </div>

                      {recommendationsLoading ? (
                        <div className="mt-4 text-sm text-white/70">Loading…</div>
                      ) : recommendations && recommendations.products.length > 0 ? (
                        <div className="mt-4 grid gap-3">
                          {recommendations.products.map((p) => (
                            <a
                              key={p.id}
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() =>
                                postEmbedEvent(
                                  'product_clicked',
                                  { product_id: p.id, product_name: p.name, url: p.url },
                                  brand,
                                )
                              }
                              className="group flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/7"
                            >
                              <ProductThumb p={p} />

                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white">{p.name}</div>
                                <div className="mt-1 text-xs text-white/60">{p.category}</div>

                                {productMatchReason(p) ? (
                                  <div className="mt-2 text-xs text-white/60">{productMatchReason(p)}</div>
                                ) : null}

                                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                                  {formatMoney(p.price, p.currency)}
                                  <ExternalLink className="h-3.5 w-3.5 opacity-70 transition group-hover:opacity-100" />
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-white/70">No product matches yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">AI doctor chat</div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (result) saveDoctorChat(result.analysis_id, [])
                          setChatTurns([])
                          setChatError(null)
                          setChatInput('')
                        }}
                        disabled={chatTurns.length === 0 && !chatError && chatInput.trim().length === 0}
                        className="px-3 py-2"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      Educational only. Not medical advice. If you have severe pain, infection, bleeding, or
                      fast-changing lesions, seek in-person medical care.
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <input
                        value={chatUserName}
                        onChange={(e) => setChatUserName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                      />

                      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={chatIncludePhoto}
                          onChange={(e) => setChatIncludePhoto(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Include my scan photo
                      </label>
                    </div>

                    <div
                      ref={chatScrollRef}
                      className="mt-4 h-80 overflow-y-auto rounded-3xl border border-white/10 bg-black/20 p-4"
                    >
                      {chatTurns.length === 0 ? (
                        <div className="text-sm text-white/60">
                          Ask about your top concerns, what the severity means, or how to adjust your routine.
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {chatTurns.map((t, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'max-w-[92%] whitespace-pre-wrap rounded-3xl border border-white/10 px-4 py-3 text-sm leading-relaxed',
                                t.role === 'user'
                                  ? 'ml-auto bg-white text-slate-900'
                                  : 'bg-white/5 text-white',
                              )}
                            >
                              {t.text}
                            </div>
                          ))}
                        </div>
                      )}

                      {chatSending ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking...
                        </div>
                      ) : null}
                      <div ref={chatEndRef} />
                    </div>

                    {chatError ? (
                      <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {chatError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void sendChat()
                          }
                        }}
                        rows={2}
                        placeholder="Ask the AI doctor…"
                        className="min-h-[48px] w-full flex-1 resize-none rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                      />

                      <Button
                        onClick={() => void sendChat()}
                        disabled={chatSending || chatInput.trim().length === 0}
                        className="sm:self-end"
                      >
                        {chatSending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            Send
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                    <div className="text-sm font-semibold text-white">How this works</div>
                    <div className="mt-2 grid gap-3 text-sm text-white/70">
                      <div>
                        Face alignment runs on-device using MediaPipe Face Landmarker (GPU-accelerated when
                        available) to keep overlays aligned to your face.
                      </div>
                      <div>
                        The API uses OpenCV + MediaPipe to compute cosmetic skin metrics (redness, texture,
                        oiliness, etc.) and picks the best frame for analysis.
                      </div>
                      <div>
                        Ingredient recommendations come from mapping the top metric severities to proven
                        ingredient categories, then products are scored against those ingredients and your
                        skin type using the catalog feed.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && !result && (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                <div className="text-sm font-semibold text-white">No results yet</div>
                <div className="mt-2 text-sm text-white/70">
                  Go back and run analysis.
                </div>
                <div className="mt-5">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to questions
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step !== 2 && step !== 3 && (
          <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => {
                if (step === 0) return
                if (step === 1) stopCamera()
                setStep((s) => Math.max(0, s - 1))
              }}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <Button
              onClick={() => {
                if (step === 1) stopCamera()
                setStep((s) => Math.min(2, s + 1))
              }}
              disabled={!canNext}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
