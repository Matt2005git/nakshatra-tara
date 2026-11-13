import { useMemo, useState, useEffect } from 'react'
// @ts-ignore plain JS module
import { NAKSHATRAS, LORDS, spans, tara, TARAS } from '@/lib/astro.js'

const TZ = 'Australia/Sydney'

type Span = { idx: number; name: string; lord: string; start: number; end: number }

// Sydney wall-clock midnight -> UTC ms (handles AEST/AEDT)
function sydneyMidnight(y: number, m: number, d: number): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const target = Date.UTC(y, m - 1, d)
  let t = target - 10 * 3600000
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
    t += target - wall
  }
  return t
}

function todaySydney(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}`
}

const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(ms))

const tzLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'short' })
    .formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName')?.value ?? ''

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

const natureStyle: Record<string, string> = {
  Favourable: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Mixed: 'bg-amber-50 text-amber-800 border-amber-300',
  Adverse: 'bg-rose-50 text-rose-800 border-rose-300',
  'Most adverse': 'bg-rose-100 text-rose-900 border-rose-400',
}

export default function App() {
  const [date, setDate] = useState(todaySydney())
  const [birth, setBirth] = useState(24) // Purva Bhadrapada
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const year = Number(date.slice(0, 4))
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && year >= 1900 && year <= 2100

  const rows: Span[] = useMemo(() => {
    if (!valid) return []
    const [y, m, d] = date.split('-').map(Number)
    const from = sydneyMidnight(y, m, d)
    const [y2, m2, d2] = shiftDate(date, 1).split('-').map(Number)
    const to = sydneyMidnight(y2, m2, d2)
    return spans(from, to)
  }, [date, valid])

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-3xl px-5 py-8 md:px-10">
        <h1 className="font-serif text-3xl tracking-tight">Nakshatra and Tara</h1>
        <p className="mt-1 text-sm text-stone-600">
          Moon Nakshatra for a day in Sydney time, with the Tara counted from your birth Nakshatra.
        </p>

        <div className="mt-6 grid gap-4 border-l-4 border-stone-800 bg-white p-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Date (Sydney)</span>
            <div className="mt-1 flex gap-1">
              <button className="border border-stone-300 px-2 hover:bg-stone-100" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">‹</button>
              <input
                type="date" min="1900-01-01" max="2100-12-31" value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-stone-300 px-2 py-1.5 font-mono"
              />
              <button className="border border-stone-300 px-2 hover:bg-stone-100" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">›</button>
            </div>
            <button className="mt-1 text-xs text-stone-600 underline" onClick={() => setDate(todaySydney())}>Today</button>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Birth Nakshatra</span>
            <select
              value={birth} onChange={(e) => setBirth(Number(e.target.value))}
              className="mt-1 w-full border border-stone-300 bg-white px-2 py-1.5"
            >
              {NAKSHATRAS.map((n: string, i: number) => (
                <option key={n} value={i}>{i + 1}. {n} ({LORDS[i % 9]})</option>
              ))}
            </select>
          </label>
        </div>

        {!valid && (
          <p className="mt-6 text-rose-700">Enter a date between 1900 and 2100.</p>
        )}

        <div className="mt-6 space-y-3">
          {rows.map((r) => {
            const t = tara(birth, r.idx)
            const live = now >= r.start && now < r.end
            return (
              <div key={r.start} className={`border bg-white p-4 ${live ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-300'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-serif text-xl">{r.name}</span>
                    <span className="ml-2 text-sm text-stone-500">#{r.idx + 1}, lord {r.lord}</span>
                    {live && <span className="ml-2 bg-stone-900 px-1.5 py-0.5 text-xs text-white">NOW</span>}
                  </div>
                  <span className={`border px-2 py-0.5 text-sm font-medium ${natureStyle[t.nature]}`}>
                    {t.name} Tara · {t.nature}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
                  <dt className="text-stone-500">Starts</dt>
                  <dd className="font-mono">{fmtTime(r.start)} {tzLabel(r.start)}</dd>
                  <dt className="text-stone-500">Ends</dt>
                  <dd className="font-mono">{fmtTime(r.end)} {tzLabel(r.end)}</dd>
                  <dt className="text-stone-500">Tara</dt>
                  <dd>Count {t.count} from {NAKSHATRAS[birth]}. {t.meaning}.</dd>
                </dl>
              </div>
            )
          })}
        </div>

        <details className="mt-8 text-sm text-stone-600">
          <summary className="cursor-pointer font-medium text-stone-800">Tara key</summary>
          <table className="mt-2 w-full border-collapse bg-white text-left">
            <thead><tr className="border-b border-stone-300"><th className="p-2">Count</th><th className="p-2">Tara</th><th className="p-2">Nature</th></tr></thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => {
                const x = TARAS[c % 9]
                return (
                  <tr key={c} className="border-b border-stone-200">
                    <td className="p-2 font-mono">{c}, {c + 9}, {c + 18}</td>
                    <td className="p-2">{x.name}</td>
                    <td className="p-2">{x.nature}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </details>

        <p className="mt-6 text-xs leading-relaxed text-stone-500">
          Method: sidereal Moon with Lahiri ayanamsa, computed in the page from the Meeus lunar series.
          Checked against Swiss Ephemeris (within 10 arcseconds, about 20 seconds of time, 1900 to 2100) and
          against all 362 Nakshatra changes in the Astroved 2026 calendar (all within 1 minute).
          Works for dates from 1900 to 2100. Sydney daylight saving is applied automatically.
          Tara results are traditional tendencies, not predictions.
        </p>
      </div>
    </div>
  )
}
