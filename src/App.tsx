import { useMemo, useState, useEffect } from 'react'
// @ts-ignore plain JS module
import { NAKSHATRAS, LORDS, spans, tara, TARAS } from '@/lib/astro.js'
// @ts-ignore plain JS module
import { positions, sunTimes, rahuKaal } from '@/lib/planets.js'

const STORE_KEY = 'nakshatra-tara.birth'

type City = { name: string; lat: number; lon: number; tz: string }
const CITIES: City[] = [
  { name: 'Sydney', lat: -(33 + 52 / 60 + 4 / 3600), lon: 151 + 12 / 60 + 26 / 3600, tz: 'Australia/Sydney' },
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631, tz: 'Australia/Melbourne' },
  { name: 'Brisbane', lat: -27.4698, lon: 153.0251, tz: 'Australia/Brisbane' },
  { name: 'Perth', lat: -31.9523, lon: 115.8613, tz: 'Australia/Perth' },
  { name: 'Adelaide', lat: -34.9285, lon: 138.6007, tz: 'Australia/Adelaide' },
  { name: 'Canberra', lat: -35.2809, lon: 149.1300, tz: 'Australia/Sydney' },
  { name: 'Hobart', lat: -42.8821, lon: 147.3272, tz: 'Australia/Hobart' },
  { name: 'Darwin', lat: -12.4634, lon: 130.8456, tz: 'Australia/Darwin' },
  { name: 'Auckland', lat: -36.8485, lon: 174.7633, tz: 'Pacific/Auckland' },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, tz: 'Asia/Singapore' },
  { name: 'Delhi', lat: 28.6139, lon: 77.2090, tz: 'Asia/Kolkata' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, tz: 'Asia/Kolkata' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, tz: 'Asia/Kolkata' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, tz: 'Asia/Kolkata' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, tz: 'Asia/Kolkata' },
  { name: 'Colombo', lat: 6.9271, lon: 79.8612, tz: 'Asia/Colombo' },
  { name: 'Kathmandu', lat: 27.7172, lon: 85.3240, tz: 'Asia/Kathmandu' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },
  { name: 'London', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { name: 'New York', lat: 40.7128, lon: -74.0060, tz: 'America/New_York' },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
]
const ALL_TZ: string[] = (() => {
  let list: string[] = []
  try { list = (Intl as any).supportedValuesOf('timeZone') as string[] } catch { /* older browser */ }
  return [...new Set([...list, ...CITIES.map((c) => c.tz)])].sort()
})()

type Span = { idx: number; name: string; lord: string; start: number; end: number }
type Pos = {
  key: string; name: string; retro: boolean; lon: number; sign: number; signName: string
  inSign: number; nak: number; nakName: string; pada: number
}

// Wall-clock time in a time zone -> UTC ms (handles daylight saving)
function localToUTC(tz: string, y: number, m: number, d: number, hh = 0, mi = 0): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const target = Date.UTC(y, m - 1, d, hh, mi)
  let t = target
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
    t += target - wall
  }
  return t
}

function localParts(tz: string, ms: number) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  )
}
function todayIn(tz: string): string {
  const p = localParts(tz, Date.now())
  return `${p.year}-${p.month}-${p.day}`
}
function localInputValue(tz: string, ms: number): string {
  const p = localParts(tz, ms)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

const fmtTime = (tz: string, ms: number) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(ms + 30000))

const fmtClock = (tz: string, ms: number) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms + 30000))

const tzLabel = (tz: string, ms: number) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName')?.value ?? ''

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const dms = (x: number) => {
  const d = Math.floor(x), mf = (x - d) * 60, m = Math.floor(mf), s = Math.floor((mf - m) * 60)
  return `${d}° ${String(m).padStart(2, '0')}' ${String(s).padStart(2, '0')}"`
}

const natureStyle: Record<string, string> = {
  Favourable: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Mixed: 'bg-amber-50 text-amber-800 border-amber-300',
  Adverse: 'bg-rose-50 text-rose-800 border-rose-300',
  'Most adverse': 'bg-rose-100 text-rose-900 border-rose-400',
}

function loadBirth(): number {
  try {
    const v = Number(localStorage.getItem(STORE_KEY))
    if (Number.isInteger(v) && v >= 0 && v < 27 && localStorage.getItem(STORE_KEY) !== null) return v
  } catch { /* storage unavailable */ }
  return 24 // Purva Bhadrapada
}

export default function App() {
  const [tab, setTab] = useState<'day' | 'planets'>('day')
  const [city, setCity] = useState<City>(CITIES[0])
  const [custom, setCustom] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-3xl px-5 py-8 md:px-10">
        <h1 className="font-serif text-3xl tracking-tight">Nakshatra and Tara</h1>
        <p className="mt-1 text-sm text-stone-600">Sidereal zodiac, Lahiri ayanamsa. Times are local to the chosen place.</p>
        <CityPicker city={city} setCity={setCity} custom={custom} setCustom={setCustom} />
        <nav className="mt-5 flex border-b border-stone-300 text-sm">
          {([['day', 'Day: Nakshatra, Tara, Rahu Kaal'], ['planets', 'Planets now']] as const).map(([k, label]) => (
            <button
              key={k} onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-3 py-2 ${tab === k ? 'border-stone-900 font-medium' : 'border-transparent text-stone-500'}`}
            >{label}</button>
          ))}
        </nav>
        {tab === 'day' ? <DayView now={now} city={city} /> : <PlanetsView now={now} city={city} />}
        <p className="mt-8 text-xs leading-relaxed text-stone-500">
          Calculated on your device. Moon Nakshatra checked against all 362 changes in the Astroved 2026 calendar
          (within 1 minute). Planets, Ascendant and Rahu (true node) checked against Swiss Ephemeris from 1950 to 2100:
          typical error under 10 arcseconds, worst case about 1 arcminute. Sunrise, sunset and Rahu Kaal match Drik
          Panchang for Sydney and the Astroved calendar for New York. Preset cities use city-centre coordinates.
          Tara and Rahu Kaal are traditional guides, not predictions.
        </p>
      </div>
    </div>
  )
}

function DayView({ now, city }: { now: number; city: City }) {
  const tz = city.tz
  const [date, setDate] = useState(todayIn(tz))
  useEffect(() => setDate(todayIn(tz)), [tz])
  const [birth, setBirthState] = useState<number>(loadBirth)
  const setBirth = (v: number) => {
    setBirthState(v)
    try { localStorage.setItem(STORE_KEY, String(v)) } catch { /* storage unavailable */ }
  }

  const year = Number(date.slice(0, 4))
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && year >= 1900 && year <= 2100

  const day = useMemo(() => {
    if (!valid) return null
    const [y, m, d] = date.split('-').map(Number)
    const from = localToUTC(tz, y, m, d)
    const [y2, m2, d2] = shiftDate(date, 1).split('-').map(Number)
    const to = localToUTC(tz, y2, m2, d2)
    const sun = sunTimes(from, city)
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const rk = sun.rise && sun.set ? rahuKaal(sun.rise, sun.set, weekday) : null
    return { rows: spans(from, to) as Span[], sun, rk }
  }, [date, valid, tz, city])

  return (
    <>
      <div className="mt-6 grid gap-4 border-l-4 border-stone-800 bg-white p-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Date ({city.name})</span>
          <div className="mt-1 flex gap-1">
            <button className="border border-stone-300 px-2 hover:bg-stone-100" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">‹</button>
            <input
              type="date" min="1900-01-01" max="2100-12-31" value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-stone-300 px-2 py-1.5 font-mono"
            />
            <button className="border border-stone-300 px-2 hover:bg-stone-100" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">›</button>
          </div>
          <button className="mt-1 text-xs text-stone-600 underline" onClick={() => setDate(todayIn(tz))}>Today</button>
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
          <span className="mt-1 block text-xs text-stone-500">Remembered on this phone.</span>
        </label>
      </div>

      {!valid && <p className="mt-6 text-rose-700">Enter a date between 1900 and 2100.</p>}

      {day && (
        <div className="mt-6 border border-stone-300 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-serif text-lg">Rahu Kaal</span>
            {day.rk && now >= day.rk.start && now < day.rk.end && (
              <span className="bg-stone-900 px-1.5 py-0.5 text-xs text-white">NOW</span>
            )}
          </div>
          {day.rk ? (
            <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-y-1">
              <dt className="text-stone-500">Rahu Kaal</dt>
              <dd className="font-mono font-medium">{fmtClock(tz, day.rk.start)} to {fmtClock(tz, day.rk.end)} {tzLabel(tz, day.rk.start)}</dd>
              <dt className="text-stone-500">Sunrise</dt>
              <dd className="font-mono">{fmtClock(tz, day.sun.rise!)}</dd>
              <dt className="text-stone-500">Sunset</dt>
              <dd className="font-mono">{fmtClock(tz, day.sun.set!)}</dd>
            </dl>
          ) : <p className="mt-2 text-stone-500">Sunrise or sunset not found for this date.</p>}
          <p className="mt-2 text-xs text-stone-500">
            One eighth of sunrise to sunset, segment set by weekday. Traditionally avoided for starting new work.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {day?.rows.map((r) => {
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
                <dd className="font-mono">{fmtTime(tz, r.start)} {tzLabel(tz, r.start)}</dd>
                <dt className="text-stone-500">Ends</dt>
                <dd className="font-mono">{fmtTime(tz, r.end)} {tzLabel(tz, r.end)}</dd>
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
    </>
  )
}

const ABBR: Record<string, string> = {
  Asc: 'Asc', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve',
  Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke', Uranus: 'Ur', Neptune: 'Ne', Pluto: 'Pl',
}

function PlanetsView({ now, city }: { now: number; city: City }) {
  const tz = city.tz
  const [fixed, setFixed] = useState<number | null>(null) // null = follow the clock
  const t = fixed ?? now
  const rows: Pos[] = useMemo(() => positions(t, city), [t, city])
  const onPick = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
    if (!m) return
    const y = +m[1]
    if (y < 1900 || y > 2100) return
    setFixed(localToUTC(tz, y, +m[2], +m[3], +m[4], +m[5]))
  }

  return (
    <>
      <div className="mt-6 border-l-4 border-stone-800 bg-white p-4 text-sm">
        <label className="block">
          <span className="font-medium">Date and time ({city.name})</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local" min="1900-01-01T00:00" max="2100-12-31T23:59"
              value={localInputValue(tz, t)} onChange={(e) => onPick(e.target.value)}
              className="border border-stone-300 px-2 py-1.5 font-mono"
            />
            <button
              className={`border px-2 py-1.5 ${fixed === null ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 hover:bg-stone-50'}`}
              onClick={() => setFixed(null)}
            >Now</button>
          </div>
        </label>
        <p className="mt-2 text-xs text-stone-500">
          {fixed === null ? 'Following the current time, updates every minute.' : 'Fixed time. Tap Now to follow the clock again.'}
          {' '}Showing {fmtTime(tz, t)} {tzLabel(tz, t)}.
        </p>
      </div>
      <div className="mt-3 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-300 bg-stone-50">
              <th className="p-2">Planet</th>
              <th className="hidden p-2 sm:table-cell">Longitude</th>
              <th className="p-2">Rashi</th>
              <th className="p-2">Nakshatra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-stone-200">
                <td className="p-2 font-medium">{r.name}{r.retro && r.key !== 'Rahu' && r.key !== 'Ketu' ? ' (R)' : ''}</td>
                <td className="hidden p-2 font-mono sm:table-cell">{dms(r.lon)}</td>
                <td className="p-2"><span className="font-mono">{dms(r.inSign)}</span> {r.signName}</td>
                <td className="p-2">{r.nakName} {r.pada}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Rahu and Ketu use the true node and always move backward. (R) marks a retrograde planet. Nakshatra shown with pada (1 to 4).
      </p>
      <h2 className="mt-6 font-serif text-xl">Lagna chart (North Indian, whole sign)</h2>
      <NorthChart rows={rows} />
    </>
  )
}

// House centres and sign-number spots, on a 400 x 400 square
const HOUSE_POS: [number, number][] = [
  [200, 105], [100, 42], [42, 100], [105, 200], [42, 300], [100, 358],
  [200, 295], [300, 358], [358, 300], [295, 200], [358, 100], [300, 42],
]
const SIGN_POS: [number, number][] = [
  [200, 182], [100, 88], [88, 104], [182, 204], [88, 300], [100, 316],
  [200, 226], [300, 316], [312, 300], [218, 204], [312, 104], [300, 88],
]

function NorthChart({ rows }: { rows: Pos[] }) {
  const lagna = rows[0].sign
  const byHouse: string[][] = Array.from({ length: 12 }, () => [])
  for (const r of rows.slice(1)) {
    const h = (r.sign - lagna + 12) % 12
    byHouse[h].push(`${ABBR[r.key]} ${Math.floor(r.inSign)}°${r.retro && r.key !== 'Rahu' && r.key !== 'Ketu' ? 'R' : ''}`)
  }
  byHouse[0].unshift(`Asc ${Math.floor(rows[0].inSign)}°`)
  return (
    <svg viewBox="-4 -4 408 408" className="mt-3 w-full max-w-md bg-white" role="img" aria-label="North Indian Lagna chart">
      <g fill="none" stroke="#57534e" strokeWidth="1.5">
        <rect x="0" y="0" width="400" height="400" />
        <line x1="0" y1="0" x2="400" y2="400" />
        <line x1="400" y1="0" x2="0" y2="400" />
        <polygon points="200,0 400,200 200,400 0,200" />
      </g>
      {SIGN_POS.map(([x, y], h) => (
        <text key={`s${h}`} x={x} y={y} textAnchor="middle" fontSize="13" fill="#a8a29e">{((lagna + h) % 12) + 1}</text>
      ))}
      {HOUSE_POS.map(([x, y], h) => {
        const items = byHouse[h]
        const lh = 14
        const top = y - ((items.length - 1) * lh) / 2
        return items.map((txt, i) => (
          <text key={`p${h}-${i}`} x={x} y={top + i * lh + 4} textAnchor="middle" fontSize="12"
            fill={txt.startsWith('Asc') ? '#1c1917' : '#b45309'} fontWeight={txt.startsWith('Asc') ? 600 : 400}>{txt}</text>
        ))
      })}
    </svg>
  )
}

function CityPicker({ city, setCity, custom, setCustom }: {
  city: City; setCity: (c: City) => void; custom: boolean; setCustom: (b: boolean) => void
}) {
  const [lat, setLat] = useState(String(city.lat.toFixed(4)))
  const [lon, setLon] = useState(String(city.lon.toFixed(4)))
  const [tz, setTz] = useState(city.tz)
  const applyCustom = () => {
    const la = Number(lat), lo = Number(lon)
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 66 || Math.abs(lo) > 180) return
    setCity({ name: `${Math.abs(la).toFixed(2)}°${la < 0 ? 'S' : 'N'} ${Math.abs(lo).toFixed(2)}°${lo < 0 ? 'W' : 'E'}`, lat: la, lon: lo, tz })
  }
  return (
    <div className="mt-4 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Place</span>
        <select
          value={custom ? '__custom' : city.name}
          onChange={(e) => {
            if (e.target.value === '__custom') { setCustom(true); return }
            setCustom(false)
            setCity(CITIES.find((c) => c.name === e.target.value)!)
          }}
          className="border border-stone-300 bg-white px-2 py-1.5"
        >
          {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          <option value="__custom">Other (enter coordinates)</option>
        </select>
        <span className="text-xs text-stone-500">{city.tz}</span>
      </label>
      {custom && (
        <div className="mt-2 grid gap-2 border border-stone-300 bg-white p-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <label className="block text-xs">Latitude (south negative)
            <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" className="mt-1 w-full border border-stone-300 px-2 py-1 font-mono text-sm" />
          </label>
          <label className="block text-xs">Longitude (west negative)
            <input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" className="mt-1 w-full border border-stone-300 px-2 py-1 font-mono text-sm" />
          </label>
          <label className="block text-xs">Time zone
            <select value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1 w-full border border-stone-300 bg-white px-2 py-1 text-sm">
              {ALL_TZ.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <button onClick={applyCustom} className="self-end border border-stone-900 bg-stone-900 px-3 py-1 text-white">Use</button>
          <p className="text-xs text-stone-500 sm:col-span-4">Decimal degrees, for example -33.87 and 151.21. Latitudes beyond 66° are not supported, since the Sun may not rise or set.</p>
        </div>
      )}
    </div>
  )
}
