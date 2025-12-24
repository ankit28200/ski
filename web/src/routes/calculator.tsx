import { useMemo, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../lib/cn'

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold tracking-wide text-white/70">
        {label}
      </span>
      {children}
    </label>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none',
        'placeholder:text-white/35 focus:border-white/20 focus:bg-white/7',
        props.className,
      )}
    />
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

function formatMoney(n: number) {
  if (!isFinite(n)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function CalculatorPage() {
  const [visitors, setVisitors] = useState('100000')
  const [aov, setAov] = useState('45')
  const [conversionRate, setConversionRate] = useState('2.0')
  const [uplift, setUplift] = useState('30')
  const [costPerVisitor, setCostPerVisitor] = useState('0.25')
  const [email, setEmail] = useState('')

  const data = useMemo(() => {
    const v = Math.max(0, Number(visitors) || 0)
    const basket = Math.max(0, Number(aov) || 0)
    const cr = Math.max(0, (Number(conversionRate) || 0) / 100)
    const up = Math.max(0, (Number(uplift) || 0) / 100)
    const cpv = Math.max(0, Number(costPerVisitor) || 0)

    const orders = v * cr
    const revenue = orders * basket

    const newCr = cr * (1 + up)
    const newOrders = v * newCr
    const newRevenue = newOrders * basket

    const additionalMonthlyRevenue = Math.max(0, newRevenue - revenue)

    const neededTrafficForSameOrders = newCr > 0 ? orders / newCr : v
    const trafficSaved = Math.max(0, v - neededTrafficForSameOrders)

    const annualAcquisitionSavings = trafficSaved * cpv * 12

    const annualAdditionalRevenue = additionalMonthlyRevenue * 12

    return {
      orders,
      revenue,
      newCr,
      additionalMonthlyRevenue,
      annualAcquisitionSavings,
      annualAdditionalRevenue,
    }
  }, [visitors, aov, conversionRate, uplift, costPerVisitor])

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="text-2xl font-semibold text-white">
            Acquisition Costs Calculator
          </div>
          <div className="mt-2 max-w-xl text-sm text-white/70">
            Estimate how improved conversion (driven by a better skin-analysis experience) can increase revenue and reduce acquisition spend.
          </div>

          <div className="mt-8 grid gap-4">
            <Field label="Website Traffic (Visitors per Month)">
              <Input
                inputMode="numeric"
                value={visitors}
                onChange={(e) => setVisitors(e.target.value)}
              />
            </Field>

            <Field label="Average Basket Size ($)">
              <Input
                inputMode="decimal"
                value={aov}
                onChange={(e) => setAov(e.target.value)}
              />
            </Field>

            <Field label="Current Conversion Rate (%) (Optional)">
              <Input
                inputMode="decimal"
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
              />
            </Field>

            <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs font-semibold tracking-wide text-white/70">
                ASSUMPTIONS (ADJUSTABLE)
              </div>

              <Field label="Expected conversion uplift (%)">
                <Input
                  inputMode="decimal"
                  value={uplift}
                  onChange={(e) => setUplift(e.target.value)}
                />
              </Field>

              <Field label="Estimated acquisition cost per visitor ($)">
                <Input
                  inputMode="decimal"
                  value={costPerVisitor}
                  onChange={(e) => setCostPerVisitor(e.target.value)}
                />
              </Field>

              <div className="text-xs text-white/60">
                These are planning assumptions. Replace with your real numbers for accurate projections.
              </div>
            </div>

            <Field label="Email">
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-glow">
            <div className="text-xs font-semibold tracking-wide text-white/70">
              CALCULATE YOUR SAVINGS
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Stat label="Additional revenue (monthly)" value={formatMoney(data.additionalMonthlyRevenue)} />
              <Stat label="Additional revenue (annual)" value={formatMoney(data.annualAdditionalRevenue)} />
              <Stat label="Acquisition savings (annual)" value={formatMoney(data.annualAcquisitionSavings)} />
              <Stat
                label="Projected conversion rate"
                value={(data.newCr * 100).toFixed(2) + '%'}
              />
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white">How this works</div>
              <div className="mt-2 text-sm leading-relaxed text-white/70">
                We estimate current orders from traffic × conversion rate. Then we apply an uplift to conversion and compute the difference in revenue.
                Acquisition savings is modeled as the traffic you no longer need to buy to achieve the same number of orders.
              </div>

              {email.trim().length > 3 && (
                <div className="mt-4 text-xs text-white/60">
                  Email captured locally: {email}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
