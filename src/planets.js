// Sidereal (Lahiri) planetary positions, Ascendant, sunrise/sunset and Rahu Kaal.
import * as Astro from 'astronomy-engine'
import { ayanamsa, NAKSHATRAS } from './astro.js'

const D2R = Math.PI / 180, R2D = 180 / Math.PI
const norm = (x) => ((x % 360) + 360) % 360

export const SYDNEY = { lat: -(33 + 52 / 60 + 4 / 3600), lon: 151 + 12 / 60 + 26 / 3600 }

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']

function siderealOffset(time) {
  const T = time.tt / 36525
  const { dpsi } = Astro.e_tilt(time) // arcsec
  return ayanamsa(T) + dpsi / 3600 // true ayanamsa: true-of-date longitude minus this
}

function tropical(body, time) {
  if (body === 'Moon') return Astro.EclipticGeoMoon(time).lon
  if (body === 'Sun') return Astro.SunPosition(time).elon
  return Astro.Ecliptic(Astro.GeoVector(body, time, true)).elon
}

// True (osculating) lunar node: from the Moon's geocentric position and velocity in the true ecliptic of date
function trueNodeTropical(time) {
  const rot = Astro.Rotation_EQJ_ECT(time)
  const dt = 1 / 24 // days
  const at = (t) => Astro.RotateVector(rot, Astro.GeoMoon(t))
  const r = at(time), a = at(time.AddDays(-dt)), b = at(time.AddDays(dt))
  const v = { x: (b.x - a.x) / (2 * dt), y: (b.y - a.y) / (2 * dt), z: (b.z - a.z) / (2 * dt) }
  const hx = r.y * v.z - r.z * v.y, hy = r.z * v.x - r.x * v.z
  return norm(Math.atan2(hx, -hy) * R2D)
}

function ascendant(time, lat, lon) {
  const { tobl } = Astro.e_tilt(time)
  const ramc = norm(Astro.SiderealTime(time) * 15 + lon) * D2R
  const e = tobl * D2R, phi = lat * D2R
  return norm(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) * R2D)
}

const BODIES = [
  ['Sun', 'Sun'], ['Moon', 'Moon'], ['Mars', 'Mars'], ['Mercury', 'Mercury'], ['Jupiter', 'Jupiter'],
  ['Venus', 'Venus'], ['Saturn', 'Saturn'], ['Uranus', 'Uranus'], ['Neptune', 'Neptune'], ['Pluto', 'Pluto'],
]

export function describe(lon) {
  const sign = Math.floor(lon / 30)
  const nak = Math.floor(lon / (360 / 27))
  const pada = Math.floor((lon % (360 / 27)) / (360 / 108)) + 1
  return { lon, sign, signName: SIGNS[sign], inSign: lon - sign * 30, nak, nakName: NAKSHATRAS[nak], pada }
}

export function positions(ms, place = SYDNEY) {
  const time = Astro.MakeTime(new Date(ms))
  const tBefore = Astro.MakeTime(new Date(ms - 6 * 3600000))
  const off = siderealOffset(time)
  const rows = []
  const asc = norm(ascendant(time, place.lat, place.lon) - off)
  rows.push({ key: 'Asc', name: 'Ascendant', retro: false, ...describe(asc) })
  for (const [key, body] of BODIES) {
    const l = norm(tropical(body, time) - off)
    const l0 = norm(tropical(body, tBefore) - siderealOffset(tBefore))
    const d = ((l - l0 + 540) % 360) - 180
    rows.push({ key, name: body, retro: key !== 'Sun' && key !== 'Moon' && d < 0, ...describe(l) })
  }
  const rahu = norm(trueNodeTropical(time) - off)
  rows.splice(8, 0,
    { key: 'Rahu', name: 'Rahu', retro: true, ...describe(rahu) },
    { key: 'Ketu', name: 'Ketu', retro: true, ...describe(norm(rahu + 180)) })
  return rows
}

// Sunrise and sunset for the Sydney civil day starting at dayStartMs (local midnight, UTC ms)
export function sunTimes(dayStartMs, place = SYDNEY) {
  const obs = new Astro.Observer(place.lat, place.lon, 0)
  const t0 = Astro.MakeTime(new Date(dayStartMs))
  const rise = Astro.SearchRiseSet(Astro.Body.Sun, obs, +1, t0, 1)
  const set = Astro.SearchRiseSet(Astro.Body.Sun, obs, -1, rise ?? t0, 1)
  return { rise: rise ? rise.date.getTime() : null, set: set ? set.date.getTime() : null }
}

// Rahu Kaal: 1/8 of sunrise-to-sunset; segment by weekday (Sun=8, Mon=2, Tue=7, Wed=5, Thu=6, Fri=4, Sat=3)
const RAHU_SEG = [8, 2, 7, 5, 6, 4, 3]
export function rahuKaal(rise, set, weekday) {
  const part = (set - rise) / 8
  const seg = RAHU_SEG[weekday]
  return { start: rise + (seg - 1) * part, end: rise + seg * part }
}
