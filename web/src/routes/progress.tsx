import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { cn } from '../lib/cn'
import { exportUserData, importUserData, loadHistory } from '../lib/storage'
import type { StoredAnalysis } from '../lib/types'

type MetricOption = { id: string; label: string }

function formatDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatDateLong(iso: string) {
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

function findMetricSeverity(entry: StoredAnalysis, metricId: string): number | null {
  const m = entry.response.metrics.find((x) => x.id === metricId)
  return typeof m?.severity === 'number' ? m.severity : null
}

export default function ProgressPage() {
  const [nonce, setNonce] = useState(0)
  const [metricId, setMetricId] = useState('')
  const [ioMessage, setIoMessage] = useState<string | null>(null)
  const [ioError, setIoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const history = useMemo(() => {
    void nonce
    return loadHistory()
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [nonce])

  const metricOptions: MetricOption[] = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of history.slice().reverse()) {
      for (const m of entry.response.metrics) {
        if (!map.has(m.id)) map.set(m.id, m.label)
      }
    }

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [history])

  useEffect(() => {
    if (metricOptions.length === 0) return
    if (!metricId || !metricOptions.some((m) => m.id === metricId)) {
      setMetricId(metricOptions[0].id)
    }
  }, [metricId, metricOptions])

  const chartData = useMemo(() => {
    return history.map((h) => {
      const severity = metricId ? findMetricSeverity(h, metricId) : null
      return {
        id: h.id,
        createdAt: h.createdAt,
        date: formatDateShort(h.createdAt),
        overall: Math.round(h.response.overall_score),
        metric: severity === null ? null : Math.round(severity),
      }
    })
  }, [history, metricId])

  const summary = useMemo(() => {
    if (history.length < 2) return null

    const first = history[0]
    const last = history[history.length - 1]

    const overallDelta = last.response.overall_score - first.response.overall_score

    let bestImprovement: { id: string; label: string; delta: number } | null = null
    let worstChange: { id: string; label: string; delta: number } | null = null

    const labelById = new Map<string, string>()
    for (const entry of history.slice().reverse()) {
      for (const m of entry.response.metrics) {
        if (!labelById.has(m.id)) labelById.set(m.id, m.label)
      }
    }

    const ids = Array.from(labelById.keys())
    for (const id of ids) {
      const a = findMetricSeverity(first, id)
      const b = findMetricSeverity(last, id)
      if (a === null || b === null) continue
      const delta = b - a

      if (delta < 0) {
        if (!bestImprovement || delta < bestImprovement.delta) {
          bestImprovement = { id, label: labelById.get(id) ?? id, delta }
        }
      }
      if (delta > 0) {
        if (!worstChange || delta > worstChange.delta) {
          worstChange = { id, label: labelById.get(id) ?? id, delta }
        }
      }
    }

    return { first, last, overallDelta, bestImprovement, worstChange }
  }, [history])

  function downloadExport() {
    setIoError(null)
    setIoMessage(null)

    try {
      const data = exportUserData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `skinsense-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setIoMessage('Exported data file downloaded.')
    } catch (e) {
      setIoError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  async function onImportFile(file: File) {
    setIoError(null)
    setIoMessage(null)

    try {
      const text = await file.text()
      const res = importUserData(text)
      setIoMessage(`Imported ${res.importedHistory} scans and ${res.importedChats} chat threads.`)
      setNonce((n) => n + 1)
    } catch (e) {
      setIoError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold text-white">Progress</div>
          <div className="mt-2 text-sm text-white/70">
            Saved locally on this device. For reliable trends, keep lighting consistent.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={downloadExport}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white/90"
          >
            Export
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void onImportFile(file)
            }}
          />
        </div>
      </div>

      {ioMessage ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {ioMessage}
        </div>
      ) : null}

      {ioError ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {ioError}
        </div>
      ) : null}

      {history.length === 0 ? (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-10">
          <div className="text-lg font-semibold text-white">No saved scans yet</div>
          <div className="mt-2 text-sm text-white/70">
            Run a scan and save your results to start tracking progress.
          </div>
          <div className="mt-6">
            <Link
              to="/scan"
              className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Start a scan
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Overall score trend</div>
                <div className="mt-1 text-xs text-white/60">Higher is better</div>
              </div>
              <div className="text-xs text-white/60">{history.length} scans</div>
            </div>

            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(2,6,23,0.95)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 16,
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { createdAt?: string } | undefined
                      return item?.createdAt ? formatDateLong(item.createdAt) : String(label)
                    }}
                    itemStyle={{ color: 'white' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke="rgba(var(--brand-primary-rgb),0.85)"
                    strokeWidth={3}
                    dot={{ r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">Highlights</div>

            {summary ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">Overall change</div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {summary.overallDelta >= 0 ? '+' : ''}
                    {summary.overallDelta.toFixed(0)} points
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {formatDateShort(summary.first.createdAt)} → {formatDateShort(summary.last.createdAt)}
                  </div>
                </div>

                {summary.bestImprovement ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs text-white/60">Most improved concern</div>
                    <div className="mt-2 text-sm font-semibold text-white">{summary.bestImprovement.label}</div>
                    <div className="mt-1 text-xs text-white/60">
                      {Math.abs(summary.bestImprovement.delta).toFixed(0)} lower severity
                    </div>
                  </div>
                ) : null}

                {summary.worstChange ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs text-white/60">Most worsened concern</div>
                    <div className="mt-2 text-sm font-semibold text-white">{summary.worstChange.label}</div>
                    <div className="mt-1 text-xs text-white/60">
                      {summary.worstChange.delta.toFixed(0)} higher severity
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/70">Add at least 2 scans to see highlights.</div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Concern severity trend</div>
                <div className="mt-1 text-xs text-white/60">Lower is better</div>
              </div>

              <select
                value={metricId}
                onChange={(e) => setMetricId(e.target.value)}
                className={cn(
                  'w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white outline-none sm:w-72',
                  'focus:border-white/20',
                )}
              >
                {metricOptions.map((m) => (
                  <option key={m.id} value={m.id} className="bg-ink-950">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(2,6,23,0.95)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 16,
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { createdAt?: string } | undefined
                      return item?.createdAt ? formatDateLong(item.createdAt) : String(label)
                    }}
                    itemStyle={{ color: 'white' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="metric"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={3}
                    dot={{ r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 lg:col-span-3">
            <div className="text-sm font-semibold text-white">Scan history</div>
            <div className="mt-2 text-xs text-white/60">Most recent at the bottom of the charts</div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
              <div className="grid grid-cols-12 gap-2 bg-white/5 px-4 py-3 text-xs font-semibold text-white/70">
                <div className="col-span-5">Date</div>
                <div className="col-span-3">Overall</div>
                <div className="col-span-4">Selected concern</div>
              </div>
              <div className="divide-y divide-white/10">
                {history
                  .slice()
                  .reverse()
                  .map((h) => {
                    const sev = metricId ? findMetricSeverity(h, metricId) : null
                    return (
                      <div
                        key={h.id}
                        className="grid grid-cols-12 gap-2 px-4 py-3 text-sm text-white/80"
                      >
                        <div className="col-span-5 text-white/70">{formatDateLong(h.createdAt)}</div>
                        <div className="col-span-3 font-semibold text-white">{Math.round(h.response.overall_score)}</div>
                        <div className="col-span-4">{sev === null ? '—' : Math.round(sev)}</div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
