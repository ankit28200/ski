import {
  ArrowRight,
  Camera,
  Cpu,
  FlaskConical,
  Shield,
  Sparkles,
  Timer,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

function Pill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
      {icon}
      <span>{label}</span>
    </div>
  )
}

function Feature({
  title,
  desc,
  icon,
}: {
  title: string
  desc: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/70">{desc}</div>
        </div>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  desc,
}: {
  n: string
  title: string
  desc: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
          {n}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/70">{desc}</div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main>
      <section className="bg-hero-gradient">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill
                  icon={
                    <Sparkles
                      className="h-3.5 w-3.5"
                      style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                    />
                  }
                  label="AI-assisted skin insights"
                />
                <Pill icon={<Shield className="h-3.5 w-3.5 text-emerald-300" />} label="Privacy-first, runs locally on your device + API" />
                <Pill icon={<Timer className="h-3.5 w-3.5 text-violet-300" />} label="Results in seconds" />
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Online Skin Analysis with AI
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                Analyze your skin comfortably from home. Upload a selfie (or capture from your camera),
                answer a few questions, and get an actionable routine with clear, visual results.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/scan"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900',
                    'shadow-glow transition hover:translate-y-[-1px] hover:bg-white/95',
                  )}
                >
                  Start free skin analysis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/calculator"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white',
                    'transition hover:bg-white/10',
                  )}
                >
                  Acquisition savings calculator
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Metrics</div>
                  <div className="mt-1 text-lg font-semibold text-white">6+ proxies</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Flow</div>
                  <div className="mt-1 text-lg font-semibold text-white">Multi-angle</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Output</div>
                  <div className="mt-1 text-lg font-semibold text-white">Routine + tips</div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow">
              <div className="rounded-[1.5rem] bg-gradient-to-b from-white/10 to-transparent p-6">
                <div className="text-xs font-semibold tracking-wide text-white/70">PREVIEW</div>
                <div className="mt-2 text-xl font-semibold text-white">Your skin dashboard</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Feature
                    title="Quality Check"
                    desc="Lighting + blur + face framing guidance before analysis."
                    icon={
                      <Camera
                        className="h-5 w-5"
                        style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                      />
                    }
                  />
                  <Feature
                    title="Face + Skin Mask"
                    desc="Landmarks detect face regions to focus on skin pixels."
                    icon={<Cpu className="h-5 w-5 text-violet-300" />}
                  />
                  <Feature
                    title="Actionable Routine"
                    desc="AM/PM steps tailored to your results and sensitivity."
                    icon={<FlaskConical className="h-5 w-5 text-emerald-300" />}
                  />
                  <Feature
                    title="Progress Tracking"
                    desc="Save scans locally and compare over time."
                    icon={<Sparkles className="h-5 w-5 text-amber-200" />}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-white">Online Skin Analysis: step by step</div>
              <div className="mt-2 max-w-xl text-sm text-white/70">
                A guided flow designed to reduce bad scans (harsh shadows, blur, bad angle) and increase
                repeatability so your progress tracking is more reliable.
              </div>

              <div className="mt-6 grid gap-4">
                <Step
                  n="1"
                  title="Preparation"
                  desc="Balanced lighting, no heavy makeup, remove glasses. Keep your face centered and close enough so skin texture is visible."
                />
                <Step
                  n="2"
                  title="Scan"
                  desc="Capture 1–3 photos (front + sides). The system picks the best-quality frame automatically."
                />
                <Step
                  n="3"
                  title="Questions"
                  desc="A few questions (age, goals, lifestyle) help personalize results and reduce misleading recommendations."
                />
                <Step
                  n="4"
                  title="Results"
                  desc="A clear dashboard with severity, confidence, and a suggested AM/PM routine to start with."
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <div className="text-sm font-semibold text-white">Real Age vs. Skin Age</div>
              <div className="mt-2 text-sm leading-relaxed text-white/70">
                Chronological age is the number of years since birth. Skin age is an estimate derived from visual
                proxies like texture, uneven tone, and irritation patterns. It can change with habits like sunscreen,
                sleep, and stress management.
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">Chronological age</div>
                  <div className="mt-1 text-base font-semibold text-white">Objective</div>
                  <div className="mt-2 text-sm text-white/70">Doesn’t change with lifestyle.</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">Skin age</div>
                  <div className="mt-1 text-base font-semibold text-white">Actionable</div>
                  <div className="mt-2 text-sm text-white/70">Can improve with consistent care.</div>
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-semibold tracking-wide text-white/70">INSTALL AS AN APP</div>
                <div className="mt-2 text-sm text-white/70">
                  Open this site on mobile and use “Add to Home Screen” for a fast, app-like experience.
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/scan"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-glow transition hover:translate-y-[-1px]"
                >
                  Try now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
