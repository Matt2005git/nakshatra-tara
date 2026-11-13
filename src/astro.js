// Sidereal Moon (Lahiri) and Nakshatra transitions.
// Moon: Meeus, Astronomical Algorithms ch. 47 (main series), plus nutation in longitude.
// Ayanamsa: Lahiri value at J2000 advanced by general precession in longitude.

const D2R = Math.PI / 180;
const norm = (x) => ((x % 360) + 360) % 360;

// [D, M, M', F, coeff 1e-6 deg]
const TERMS = [
  [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],
  [0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],
  [2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
  [0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],
  [4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
  [2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
  [2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],
  [2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],
  [0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
  [2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
  [2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],
  [2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
  [4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],
  [1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],
  [0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],
];

// Delta T (seconds), Espenak & Meeus polynomials, 1900-2150.
export function deltaT(year) {
  const y = year;
  if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119*t - 0.0598939*t*t + 0.0061966*t**3 - 0.000197*t**4; }
  if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493*t - 0.076100*t*t + 0.0020936*t**3; }
  if (y < 1961) { const t = y - 1950; return 29.07 + 0.407*t - t*t/233 + t**3/2547; }
  if (y < 1986) { const t = y - 1975; return 45.45 + 1.067*t - t*t/260 - t**3/718; }
  if (y < 2005) { const t = y - 2000; return 63.86 + 0.3345*t - 0.060374*t*t + 0.0017275*t**3 + 0.000651814*t**4 + 0.00002373599*t**5; }
  // 2005 onward: observed ~69 s in 2026, then the Swiss Ephemeris extrapolation
  if (y < 2026) { return 64.7 + 0.2 * (y - 2005); }
  const P = [[2026, 68.9], [2050, 74.6], [2075, 82.8], [2100, 93.2], [2150, 121.7]];
  for (let i = 0; i < P.length - 1; i++) {
    const [y0, v0] = P[i], [y1, v1] = P[i + 1];
    if (y < y1) return v0 + (v1 - v0) * (y - y0) / (y1 - y0);
  }
  return 121.7;
}

// ms timestamp (UTC) -> Julian Day (UT)
const jdUT = (ms) => ms / 86400000 + 2440587.5;

export function moonSidereal(ms) {
  const year = 1970 + ms / 31557600000;
  const jde = jdUT(ms) + deltaT(year) / 86400;
  const T = (jde - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421*T - 0.0015786*T*T + T**3/538841 - T**4/65194000;
  const D  = 297.8501921 + 445267.1114034*T - 0.0018819*T*T + T**3/545868 - T**4/113065000;
  const M  = 357.5291092 + 35999.0502909*T - 0.0001536*T*T + T**3/24490000;
  const Mp = 134.9633964 + 477198.8675055*T + 0.0087414*T*T + T**3/69699 - T**4/14712000;
  const F  = 93.2720950 + 483202.0175233*T - 0.0036539*T*T - T**3/3526000 + T**4/863310000;
  const A1 = 119.75 + 131.849*T, A2 = 53.09 + 479264.290*T;
  const E = 1 - 0.002516*T - 0.0000074*T*T;
  let sl = 0;
  for (const [d, m, mp, f, c] of TERMS) {
    let k = c;
    if (Math.abs(m) === 1) k *= E; else if (Math.abs(m) === 2) k *= E*E;
    sl += k * Math.sin((d*D + m*M + mp*Mp + f*F) * D2R);
  }
  sl += 3958*Math.sin(A1*D2R) + 1962*Math.sin((Lp - F)*D2R) + 318*Math.sin(A2*D2R);
  const lon = Lp + sl / 1e6;
  // nutation in longitude (arcsec)
  const Om = 125.04452 - 1934.136261*T;
  const Ls = 280.4665 + 36000.7698*T;
  const dpsi = -17.20*Math.sin(Om*D2R) - 1.32*Math.sin(2*Ls*D2R) - 0.23*Math.sin(2*Lp*D2R) + 0.21*Math.sin(2*Om*D2R);
  const tropical = lon + dpsi / 3600;
  return norm(tropical - ayanamsa(T) - dpsi / 3600 * NUT_IN_AYAN);
}

// Lahiri ayanamsa (mean), degrees; T in Julian centuries TT from J2000.
export const AYAN_J2000 = 23.857092;
export const NUT_IN_AYAN = 1; // 1 = sidereal longitude excludes nutation (mean-equinox based)
export function ayanamsa(T) {
  return AYAN_J2000 + (5028.796195*T + 1.1054348*T*T) / 3600;
}

export const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
  "Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati",
];
export const LORDS = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const SPAN = 360 / 27;

export const nakIndex = (ms) => Math.floor(moonSidereal(ms) / SPAN);

// Find the moment the Moon crosses into Nakshatra boundary (boundary longitude b) near ms.
function crossing(lo, hi, idxAfter) {
  // invariant: nakIndex(lo) != idxAfter, nakIndex(hi) == idxAfter
  for (let i = 0; i < 40 && hi - lo > 500; i++) {
    const mid = (lo + hi) / 2;
    if (nakIndex(mid) === idxAfter) hi = mid; else lo = mid;
  }
  return hi;
}

const STEP = 2 * 3600000; // 2 h, shorter than any Nakshatra (min ~19 h)

export function startOf(ms) {
  const idx = nakIndex(ms);
  let hi = ms, lo = ms - STEP;
  while (nakIndex(lo) === idx) { hi = lo; lo -= STEP; }
  return crossing(lo, hi, idx);
}
export function endOf(ms) {
  const idx = nakIndex(ms);
  let lo = ms, hi = ms + STEP;
  while (nakIndex(hi) === idx) { lo = hi; hi += STEP; }
  return crossing(lo, hi, (idx + 1) % 27);
}

// All Nakshatra spans touching [fromMs, toMs)
export function spans(fromMs, toMs) {
  const out = [];
  let t = fromMs;
  while (t < toMs) {
    const idx = nakIndex(t);
    const s = startOf(t), e = endOf(t);
    out.push({ idx, name: NAKSHATRAS[idx], lord: LORDS[idx % 9], start: s, end: e });
    t = e + 1000;
  }
  return out;
}

export const TARAS = [
  { name: "Parama Mitra", nature: "Favourable", meaning: "Great friend, best support" },
  { name: "Janma", nature: "Mixed", meaning: "Birth star, body and mind. Avoided for new starts" },
  { name: "Sampat", nature: "Favourable", meaning: "Wealth, prosperity" },
  { name: "Vipat", nature: "Adverse", meaning: "Danger, obstacles, loss" },
  { name: "Kshema", nature: "Favourable", meaning: "Well-being, safety" },
  { name: "Pratyari", nature: "Adverse", meaning: "Obstruction, opposition" },
  { name: "Sadhana", nature: "Favourable", meaning: "Accomplishment, success of effort" },
  { name: "Naidhana", nature: "Most adverse", meaning: "Destruction, danger. Avoided most of all" },
  { name: "Mitra", nature: "Favourable", meaning: "Friend, help" },
];
export function tara(birthIdx, dayIdx) {
  const count = ((dayIdx - birthIdx + 27) % 27) + 1;
  return { count, ...TARAS[count % 9] };
}
