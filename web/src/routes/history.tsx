import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { doctorChat } from '../lib/api'
import { readBrandConfig } from '../lib/brand'
import { loadCatalog } from '../lib/catalog'
import type { CatalogProduct } from '../lib/catalog'
import { cn } from '../lib/cn'
import { buildRecommendations } from '../lib/recommend'
import { clearHistory, loadDoctorChat, loadHistory, saveDoctorChat } from '../lib/storage'
import type { ChatTurn, StoredAnalysis } from '../lib/types'

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function SeverityChart({ entry }: { entry: StoredAnalysis }) {
  const data = useMemo(
    () =>
      entry.response.metrics
        .map((m) => ({
          name: m.id.replace(/_/g, ' '),
          severity: Math.round(m.severity),
        }))
        .sort((a, b) => b.severity - a.severity),
    [entry],
  )

  return (
    <div className="h-64 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold tracking-wide text-white/70">
        Severity (higher = more visible)
      </div>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} domain={[0, 100]} />
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
              fill="rgba(var(--brand-primary-rgb),0.75)"
              radius={[10, 10, 10, 10]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [selected, setSelected] = useState<StoredAnalysis | null>(null)
  const [nonce, setNonce] = useState(0)

  const location = useLocation()

  const brand = useMemo(() => readBrandConfig(), [])
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])

  const [chatUserName, setChatUserName] = useState('')
  const [chatIncludePhoto, setChatIncludePhoto] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatById, setChatById] = useState<Record<string, ChatTurn[]>>({})
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const history = useMemo(() => {
    void nonce
    return loadHistory()
  }, [nonce])

  const currentTurns = useMemo(() => {
    if (!selected) return []
    return chatById[selected.id] ?? []
  }, [chatById, selected])

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
  }, [currentTurns.length, chatSending])

  useEffect(() => {
    if (selected) {
      setChatById((prev) => ({ ...prev, [selected.id]: loadDoctorChat(selected.id) }))
    }
    setChatError(null)
    setChatInput('')
    setChatIncludePhoto(false)
  }, [selected?.id])

  useEffect(() => {
    let active = true
    void loadCatalog({ catalogUrl: brand.catalogUrl, brandName: brand.name })
      .then((items) => {
        if (active) setCatalog(items)
      })
      .catch(() => {
        if (active) setCatalog([])
      })
    return () => {
      active = false
    }
  }, [brand.catalogUrl, brand.name])

  async function sendChat() {
    const entry = selected
    if (!entry || chatSending) return

    const text = chatInput.trim()
    if (!text) return

    const historyTurns = chatById[entry.id] ?? []

    const optimistic = [...historyTurns, { role: 'user', text }]
    setChatById((prev) => ({ ...prev, [entry.id]: optimistic }))
    saveDoctorChat(entry.id, optimistic)
    setChatInput('')

    setChatSending(true)
    setChatError(null)

    try {
      let image: Blob | null = null
      if (chatIncludePhoto && entry.thumb) {
        try {
          image = await fetch(entry.thumb).then((r) => r.blob())
        } catch {
          image = null
        }
      }

      const allowedProducts =
        catalog.length > 0
          ? buildRecommendations({ analysis: entry.response, catalog, maxProducts: 6 }).products
          : []

      const res = await doctorChat({
        message: text,
        history: historyTurns,
        analysis: { ...entry.response, heatmaps: null, debug: null },
        products: allowedProducts,
        userName: chatUserName,
        image,
      })

      const nextTurns = [...optimistic, { role: 'model', text: res.reply }]
      setChatById((prev) => ({ ...prev, [entry.id]: nextTurns }))
      saveDoctorChat(entry.id, nextTurns)
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setChatSending(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold text-white">History</div>
          <div className="mt-2 text-sm text-white/70">
            Saved locally on this device. Use consistent lighting for best comparisons.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/progress${location.search}`}
            className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            View progress
          </Link>
          <button
            onClick={() => {
              clearHistory()
              setSelected(null)
              setChatById({})
              setNonce((n) => n + 1)
            }}
            className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Clear history
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-10">
          <div className="text-lg font-semibold text-white">No saved scans yet</div>
          <div className="mt-2 text-sm text-white/70">
            Run a scan and save your results to start tracking progress.
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelected(h)}
                className={cn(
                  'text-left rounded-[2rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/7',
                  selected?.id === h.id && 'bg-white/8',
                )}
              >
                <div className="flex items-center gap-4">
                  {h.thumb ? (
                    <img
                      src={h.thumb}
                      alt="scan thumbnail"
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-2xl bg-white/10" />
                  )}

                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">
                      {h.response.skin_type}
                      <span className="ml-2 text-white/50">•</span>
                      <span className="ml-2 text-white/70">{formatDate(h.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Overall score: {Math.round(h.response.overall_score)}/100
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold text-white">
                    {Math.round(h.response.overall_score)}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Scan details
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {formatDate(selected.createdAt)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                  Quality: {(selected.response.quality.score * 100).toFixed(0)}%
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">Skin type</div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {selected.response.skin_type}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">Fitzpatrick estimate</div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {selected.response.estimated_fitzpatrick ?? '—'}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <SeverityChart entry={selected} />
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white">Notes</div>
                <div className="mt-2 grid gap-2 text-sm text-white/70">
                  {selected.response.notes.map((n, i) => (
                    <div key={i}>{n}</div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">AI doctor chat</div>
                  <button
                    onClick={() => {
                      if (!selected) return
                      saveDoctorChat(selected.id, [])
                      setChatById((prev) => ({ ...prev, [selected.id]: [] }))
                      setChatError(null)
                      setChatInput('')
                    }}
                    disabled={currentTurns.length === 0 && !chatError && chatInput.trim().length === 0}
                    className={cn(
                      'rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10',
                      (currentTurns.length === 0 && !chatError && chatInput.trim().length === 0) &&
                        'cursor-not-allowed opacity-50 hover:bg-white/5',
                    )}
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-2 text-xs text-white/60">
                  Educational only. Not medical advice. If you have severe pain, infection, bleeding, or
                  fast-changing lesions, seek in-person medical care.
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={chatUserName}
                    onChange={(e) => setChatUserName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />

                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/80',
                      !selected.thumb && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={!selected.thumb}
                      checked={chatIncludePhoto}
                      onChange={(e) => setChatIncludePhoto(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Include scan photo
                  </label>
                </div>

                <div
                  ref={chatScrollRef}
                  className="mt-4 h-72 overflow-y-auto rounded-3xl border border-white/10 bg-black/20 p-4"
                >
                  {currentTurns.length === 0 ? (
                    <div className="text-sm text-white/60">
                      Ask about what your metrics mean or how to adjust your routine.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {currentTurns.map((t, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'max-w-[92%] whitespace-pre-wrap rounded-3xl border border-white/10 px-4 py-3 text-sm leading-relaxed',
                            t.role === 'user' ? 'ml-auto bg-white text-slate-900' : 'bg-white/5 text-white',
                          )}
                        >
                          {t.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {chatSending ? (
                    <div className="mt-3 text-sm text-white/60">Thinking...</div>
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

                  <button
                    onClick={() => void sendChat()}
                    disabled={chatSending || chatInput.trim().length === 0}
                    className={cn(
                      'rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white/90 sm:self-end',
                      (chatSending || chatInput.trim().length === 0) &&
                        'cursor-not-allowed opacity-60 hover:bg-white',
                    )}
                  >
                    {chatSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10">
              <div className="text-lg font-semibold text-white">Select a scan</div>
              <div className="mt-2 text-sm text-white/70">
                Choose an entry from the left to view details.
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
