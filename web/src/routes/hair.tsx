import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { analyzeHair } from '../lib/api'
import { readBrandConfig } from '../lib/brand'
import { postEmbedEvent } from '../lib/embed'
import type { AnalysisAnswers, AnalysisResponse } from '../lib/types'

type CaptureItem = {
  id: string
  blob: Blob
  url: string
}

function makeId() {
  return Math.random().toString(16).slice(2)
}

function toggle(list: string[], setList: (v: string[]) => void, v: string) {
  setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-2xl border px-3 py-2 text-sm transition ' +
        (active
          ? 'border-white/10 text-white'
          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white')
      }
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

export default function HairPage() {
  const location = useLocation()
  const brand = useMemo(() => readBrandConfig(location.search), [location.search])

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const capturesRef = useRef<CaptureItem[]>([])

  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [concerns, setConcerns] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)

  useEffect(() => {
    postEmbedEvent('ready', { route: 'hair' }, brand)
  }, [brand])

  useEffect(() => {
    return () => {
      try {
        capturesRef.current.forEach((c) => URL.revokeObjectURL(c.url))
      } catch {
        // ignore
      }
    }
  }, [])

  function updateCaptures(next: CaptureItem[]) {
    capturesRef.current = next
    setCaptures(next)
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const next = [...capturesRef.current]
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      next.unshift({ id: makeId(), blob: f, url: URL.createObjectURL(f) })
      if (next.length >= 3) break
    }
    updateCaptures(next.slice(0, 3))
  }

  function removeCapture(id: string) {
    const cur = capturesRef.current
    const it = cur.find((c) => c.id === id)
    if (it) URL.revokeObjectURL(it.url)
    updateCaptures(cur.filter((c) => c.id !== id))
  }

  function resetAll() {
    capturesRef.current.forEach((c) => URL.revokeObjectURL(c.url))
    updateCaptures([])
    setAge('')
    setSex('')
    setConcerns([])
    setGoals([])
    setLoading(false)
    setError(null)
    setResult(null)
    setStep(0)
  }

  async function runAnalysis() {
    setLoading(true)
    setError(null)
    setResult(null)
    postEmbedEvent('analysis_started', { images: capturesRef.current.length }, brand)

    const answers: AnalysisAnswers = {
      age: age ? Number(age) : null,
      sex: sex || null,
      concerns,
      goals,
      lifestyle: null,
    }

    try {
      const res = await analyzeHair({ images: capturesRef.current.map((c) => c.blob), answers })
      setResult(res)
      setStep(2)
      postEmbedEvent('analysis_completed', { analysis_id: res.analysis_id, skin_type: res.skin_type }, brand)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unexpected error'
      setError(message)
      setStep(2)
      postEmbedEvent('analysis_failed', { message }, brand)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold text-white">Hair & Scalp Analysis</div>
          <div className="mt-2 text-sm text-white/70">MVP: upload a clear scalp/hair photo (no camera yet).</div>
        </div>
        <div className="text-sm text-white/60">Step {step + 1} / 3</div>
      </div>

      <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
        {step === 0 && (
          <div className="grid gap-5">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Upload photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>

            {captures.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {captures.map((c) => (
                  <div
                    key={c.id}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                  >
                    <img src={c.url} className="h-28 w-full object-cover" alt="capture" />
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

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                onClick={resetAll}
                disabled={captures.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
                onClick={() => setStep(1)}
                disabled={captures.length === 0}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-semibold tracking-wide text-white/70">Age (optional)</span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  inputMode="numeric"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold tracking-wide text-white/70">Sex (optional)</span>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                  onClick={() => setStep(0)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
                  onClick={runAnalysis}
                  disabled={captures.length === 0 || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-semibold tracking-wide text-white/70">Concerns</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[['dandruff', 'Dandruff'], ['hair_fall', 'Hair fall'], ['oiliness', 'Oily scalp'], ['dryness', 'Dry scalp'], ['itch', 'Itch']].map(
                    ([id, label]) => (
                      <Chip
                        key={id}
                        label={label}
                        active={concerns.includes(id)}
                        onClick={() => toggle(concerns, setConcerns, id)}
                      />
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-semibold tracking-wide text-white/70">Goals</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[['less_flakes', 'Less flakes'], ['growth', 'Growth'], ['less_shedding', 'Less shedding'], ['shine', 'Shine']].map(
                    ([id, label]) => (
                      <Chip
                        key={id}
                        label={label}
                        active={goals.includes(id)}
                        onClick={() => toggle(goals, setGoals, id)}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            {loading && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Loading…</div>
            )}

            {!loading && error && (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setStep(0)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-2xl text-sm font-semibold text-white/80 hover:bg-white/10 px-4 py-3"
                    onClick={resetAll}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Start over
                  </button>
                </div>
              </div>
            )}

            {!loading && result && (
              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="text-xs font-semibold tracking-wide text-white/70">SUMMARY</div>
                  <div className="mt-2 text-xl font-semibold text-white">{result.skin_type}</div>
                  <div className="mt-2 text-sm text-white/70">Overall score: {Math.round(result.overall_score)}/100</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {result.metrics.map((m) => (
                    <div key={m.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-sm font-semibold text-white">{m.label}</div>
                        <div className="rounded-2xl bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
                          {Math.round(m.severity)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-white/70">{m.summary}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                    onClick={resetAll}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    New scan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
