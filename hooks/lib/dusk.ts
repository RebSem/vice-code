// Vice Code dusk: a Miami sunset printed in fine marks on a stock.
// The postcard stands at the left, in the strip no layout covers with the reading column: a slatted sun
// sinking behind a stepped deco tower, a lower block and two palms. A quieter group answers it at the right.
// Three kinds of mark, each in its cheapest batched form:
//  - the glow: an ordered (Bayer 4x4) dither of 4-unit pixels in five close inks, one <pattern> per
//    (ink, level) and run-length regions in 16-unit tiles. Its tone is one smooth function of x and y,
//    centred on the sun, mirrored into the water and carried to the bottom edge;
//  - a sparse field of small glyphs on an 8-unit grid in the sky, written at their real size, one <text>
//    per few hundred glyphs with a per-glyph x list;
//  - the city, the palms, the far shore and the slatted sun: crisp silhouettes in 4-unit pixels (fronds
//    in 2-unit pixels), written as run-length rectangle paths, one path per ink.
// Pure string building: no imports, no randomness, the same arguments give the same string.

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night'
export type Stock = 'auto' | 'light' | 'dark'
type Mode = 'light' | 'dark'

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
/** One silhouette pixel, in viewBox units. */
const PX = 4
/** One glyph cell, in viewBox units. */
const CELL = 8
/** One dither tile: a 4x4 matrix of pixels. */
const TILE = 16

// ---------------------------------------------------------------- inks

/** The inks of one time of day on one stock. Every value becomes a CSS custom property on the root. */
type Inks = {
  s0: string // the stock: the opaque ground
  q1: string; q2: string; q3: string; q4: string; q5: string // the glow, faint to hot
  k1: string; k2: string; k3: string; k4: string // the glyph field: high sky, mid sky, horizon, near the sun
  sa: string; sb: string; sg: string // the sun, crown and foot, and what shows through its slats
  c0: string; c1: string; c2: string // far shore, towers, their sunlit edge
  p1: string // palms
  w1: string; w2: string; w3: string // lit windows
  st: string; mo: string // stars and the moon
  sl: string // the helicopter's searchlight
  h: string // the banner's lit group
  wo: number // how much the lit windows show
}

// Dark stock: towers one deep ink a little under the stock, palms a step under that; no sun, glow or
// reflection ink has a relative luminance above 0.14, so words laid over them through the app's wash keep
// 7:1 (body) and 4.5:1 (muted). The moon (0.14, its rim under 0.18), the stars and the sky's glyphs (under
// 0.16) are dim too: they lie where an open sidebar lists its sessions. Only specks are brighter: lit
// windows, and the patrol lights of the game's heat. Light stock: every ink is darker than the stock and
// none is so dark that muted words over it, through the 58% wash, fall under 4.5:1; towers and palms sit at
// a relative luminance of 0.43-0.45, which is 1.7-1.9:1 to the stock.
const INKS: Record<TimeOfDay, Record<Mode, Inks>> = {
  dawn: {
    light: { s0: '#f4eae8', q1: '#f6dce0', q2: '#f9cad6', q3: '#fcbec2', q4: '#ffc2a4', q5: '#ffc08a', k1: '#c2a8c8', k2: '#d6a0bc', k3: '#e2a288', k4: '#e6a070', sa: '#f9bf74', sb: '#f6ac90', sg: '#f8e0d4', c0: '#ecc4c2', c1: '#d9a4b2', c2: '#ecb6a2', p1: '#d7a1b2', w1: '#c75a86', w2: '#c98a3a', w3: '#3d9aa0', st: '#b9a3c8', mo: '#e4d3d6', sl: '#ea96c0', h: '#d6247a', wo: 0 },
    dark: { s0: '#151126', q1: '#1d1432', q2: '#2b1844', q3: '#441c52', q4: '#642454', q5: '#86343e', k1: '#463a70', k2: '#563266', k3: '#6c3a4c', k4: '#8a5040', sa: '#9e5230', sb: '#982c4c', sg: '#3c1a4c', c0: '#2a1840', c1: '#100c1e', c2: '#6a2c44', p1: '#0a0714', w1: '#e86a9c', w2: '#e8a860', w3: '#58b8c0', st: '#7064ae', mo: '#f3e2c8', sl: '#ffd9ec', h: '#ff7ab0', wo: 1 },
  },
  day: {
    light: { s0: '#f1ecf2', q1: '#efe3ec', q2: '#f2d9e2', q3: '#f5cfd2', q4: '#f8c6b8', q5: '#fbbe9e', k1: '#b2afd4', k2: '#c9a5cf', k3: '#dcac94', k4: '#e2b078', sa: '#fac67c', sb: '#f8b694', sg: '#f4e2e2', c0: '#e6cbd2', c1: '#d3a7b9', c2: '#e8bcae', p1: '#d0a4b6', w1: '#c75a86', w2: '#c98a3a', w3: '#3d9aa0', st: '#b3a8cc', mo: '#e0d6e2', sl: '#ea96c0', h: '#d6247a', wo: 0 },
    dark: { s0: '#141024', q1: '#1b1634', q2: '#251a46', q3: '#3a2052', q4: '#5a2856', q5: '#7a3a46', k1: '#423e7a', k2: '#563666', k3: '#6a4038', k4: '#8a6030', sa: '#94562a', sb: '#983c3c', sg: '#2a1c48', c0: '#2a1c44', c1: '#0f0c1e', c2: '#5c2e48', p1: '#090716', w1: '#e86a9c', w2: '#e8a860', w3: '#58b8c0', st: '#7064ae', mo: '#f3e2c8', sl: '#ffd9ec', h: '#ff7ab0', wo: 1 },
  },
  sunset: {
    light: { s0: '#f3e6e4', q1: '#f6d8de', q2: '#f9cad8', q3: '#fdc0c6', q4: '#ffc4a6', q5: '#ffc28e', k1: '#bc9bbd', k2: '#d58aaa', k3: '#e3927a', k4: '#e9a06c', sa: '#f8b062', sb: '#f8ac90', sg: '#f9dccc', c0: '#ecbab8', c1: '#dda3b3', c2: '#eeac96', p1: '#daa0b0', w1: '#c75a86', w2: '#c98a3a', w3: '#3d9aa0', st: '#b79bc4', mo: '#e2c9c6', sl: '#ea96c0', h: '#c2206a', wo: 0 },
    dark: { s0: '#140e22', q1: '#1e1030', q2: '#2e1240', q3: '#4a1650', q4: '#661a4c', q5: '#8a2e3a', k1: '#4a3872', k2: '#5e2c5a', k3: '#783140', k4: '#98482e', sa: '#a0482a', sb: '#a02a4a', sg: '#3a1246', c0: '#2a0f3a', c1: '#0e0919', c2: '#7a2c3c', p1: '#080510', w1: '#e86a9c', w2: '#e8a860', w3: '#58b8c0', st: '#7064ae', mo: '#f3e2c8', sl: '#ffd9ec', h: '#ff7ab0', wo: 1 },
  },
  night: {
    light: { s0: '#ebe6f0', q1: '#eadcf0', q2: '#eecfee', q3: '#f3c2e6', q4: '#f8b8d6', q5: '#fcb4c2', k1: '#b4a9cf', k2: '#c6a9cf', k3: '#d4a9c0', k4: '#d8acb8', sa: '#e6d8e2', sb: '#e2cad8', sg: '#e9def0', c0: '#dccbe0', c1: '#c6a9ca', c2: '#d8b4cc', p1: '#c5a6c9', w1: '#c0508a', w2: '#c0842e', w3: '#2f9298', st: '#a597c6', mo: '#cdb8d4', sl: '#dc94c6', h: '#d6247a', wo: 0.8 },
    dark: { s0: '#0f0b1c', q1: '#170e2a', q2: '#241038', q3: '#361246', q4: '#4c1452', q5: '#661a5e', k1: '#3a3268', k2: '#462a5e', k3: '#54294c', k4: '#5a3a50', sa: '#f3e6c8', sb: '#e8d0b0', sg: '#160e28', c0: '#1e0e30', c1: '#0a0715', c2: '#4a1e52', p1: '#06040e', w1: '#ff6aa8', w2: '#f0a858', w3: '#58b8c0', st: '#7064ae', mo: '#796f96', sl: '#ffd9ec', h: '#ff7ab0', wo: 1 },
  },
}

/**
 * The light per time of day. band: how many glow inks the horizon climbs through at the sun; reach: how
 * high the band climbs over the sun, as a share of the horizon's height; sun: the glow around the sun,
 * in inks; far: how much of the band the far side keeps.
 */
const LIGHT: Record<TimeOfDay, { band: number; reach: number; sun: number; far: number }> = {
  dawn: { band: 3, reach: 0.6, sun: 1.4, far: 0.36 },
  day: { band: 2.2, reach: 0.8, sun: 0.9, far: 0.42 },
  sunset: { band: 3.4, reach: 0.68, sun: 1.6, far: 0.38 },
  night: { band: 4.3, reach: 0.5, sun: 0, far: 0.6 },
}

/** What share of its strength at the horizon the water keeps at the bottom edge. */
const SEA_FOOT = 0.5

/** The two lights of a patrol car: the only colours that are not an ink. */
const RED = '#e5484d'
const BLUE = '#3f8cff'

function vars(k: Inks): string {
  return (Object.keys(k) as (keyof Inks)[]).map(name => `--${name}:${k[name]}`).join(';')
}

// ---------------------------------------------------------------- numbers

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A number as short as it can be written. */
function num(v: number): string {
  const s = String(Math.round(v * 1000) / 1000)
  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? `-${s.slice(2)}` : s
}

/** The 4x4 dither matrix, and where the pixel of each threshold sits inside a tile. */
const BAYER4: readonly (readonly number[])[] = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
const SPOT: readonly (readonly [number, number])[] = (() => {
  const spots: [number, number][] = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) spots[BAYER4[y]?.[x] ?? 0] = [x, y]
  return spots
})()

// ---------------------------------------------------------------- the plan

type Tower =
  | { kind: 'deco'; x: number; w: number; top: number } // stepped crown, fin and spire
  | { kind: 'slab'; x: number; w: number; top: number } // flat roof, a rooftop box and an antenna
  | { kind: 'hotel'; x: number; w: number; top: number; dir: 1 | -1 } // terraces stepping down to one side
type Palm = { x: number; h: number; lean: number; frond: number } // base x, height, lean at the crown, frond length (all units)
type Side = { towers: Tower[]; palms: Palm[]; land: [number, number] }

/** Where things stand, in viewBox units. */
type Plan = {
  w: number; h: number; horizon: number
  sun: { x: number; y: number; r: number } | null
  /** Where the glow is centred: the sun, or by night the moon's side of the sky. */
  gx: number
  moon: { x: number; y: number; r: number } | null
  calm: { x0: number; x1: number } | null // the reading column: only the glyph field is kept quiet there
  clouds: readonly (readonly [y: number, x0: number, x1: number])[]
  left: Side
  right: Side
  /** The far shore: clusters of low buildings [x0, x1, tallest] along one continuous land line. */
  shore: readonly (readonly [number, number, number])[]
  kr: readonly (readonly [number, number])[] // patrol light pairs on the waterline
  heli: readonly (readonly [x: number, y: number, tx: number, ty: number, side: 'L' | 'R'])[]
  /** How far the left group steps right in the narrowest box: the glow is drawn that much further left. */
  reachX: number
  /** How much higher the glow climbs than the time of day says: a short banner needs a gentler ramp. */
  reachK: number
}

function sunFor(tod: TimeOfDay, x: number, horizon: number, r: number, highY: number) {
  if (tod === 'night') return null
  if (tod === 'day') return { x: x - Math.round(r * 0.1), y: highY, r: Math.round(r * 0.58) }
  if (tod === 'dawn') return { x, y: horizon - Math.round(r * 0.22), r: Math.round(r * 0.92) }
  return { x, y: horizon, r }
}

function backdropPlan(tod: TimeOfDay): Plan {
  const horizon = 792
  return {
    w: 1600, h: 1000, horizon,
    // The whole left group stands in the strip (x 0-190) that no layout covers with the reading column: the
    // sun's right edge is at x 188. The tower hides the sun's left end, the block stands against the tower,
    // the tall palm's trunk crosses the sun and the short palm leans in over its right foot.
    sun: sunFor(tod, 96, horizon, 92, 200),
    gx: 96,
    moon: tod === 'night' ? { x: 140, y: 92, r: 22 } : null,
    calm: { x0: 205, x1: 1040 },
    clouds: [[440, -40, 230], [470, 1240, 1640], [560, 1190, 1640], [610, -40, 120], [372, 1300, 1640], [300, -40, 180], [250, 1340, 1640]],
    left: {
      towers: [
        { kind: 'slab', x: 68, w: 24, top: 740 },
        { kind: 'deco', x: 32, w: 48, top: 330 },
      ],
      palms: [
        { x: 132, h: 204, lean: -12, frond: 46 },
        { x: 180, h: 100, lean: -20, frond: 22 },
      ],
      land: [0, 188],
    },
    right: {
      towers: [
        { kind: 'hotel', x: 1314, w: 60, top: 704, dir: 1 },
        { kind: 'deco', x: 1452, w: 40, top: 548 },
      ],
      palms: [
        { x: 1346, h: 170, lean: 12, frond: 50 },
        { x: 1566, h: 210, lean: -26, frond: 56 },
      ],
      land: [1270, 1608],
    },
    shore: [[318, 408, 20], [520, 556, 12], [668, 790, 28], [930, 1004, 16], [1132, 1222, 24]],
    // The second pair stands between the two palm trunks' feet, left of the column.
    kr: [[40, 788], [164, 788], [1300, 788]],
    // Each beam ends on the row above its tower's spire tip, so the spire stays whole.
    heli: [[70, 140, 30, 330, 'L'], [1360, 318, 1452, 548, 'R']],
    reachX: 192,
    reachK: 1,
  }
}

function stripPlan(tod: TimeOfDay): Plan {
  const horizon = 112
  // The same arrangement as the backdrop, in small, with room to spare: the short palm stands clear of the
  // sun's right foot. By day the sun stands high in the free sky right of the palms, where the moon stands
  // by night; otherwise it sinks behind the group.
  const sx = tod === 'day' ? 196 : 84
  return {
    w: 720, h: 160, horizon,
    sun: sunFor(tod, sx, horizon, 52, 44),
    gx: sx,
    moon: tod === 'night' ? { x: 184, y: 32, r: 12 } : null,
    calm: null,
    clouds: [[40, 160, 400], [60, 520, 720], [28, 580, 720]],
    left: {
      towers: [
        { kind: 'slab', x: 52, w: 20, top: 94 },
        { kind: 'deco', x: 24, w: 28, top: 18 },
      ],
      palms: [
        { x: 96, h: 72, lean: -8, frond: 26 },
        { x: 148, h: 44, lean: -10, frond: 18 },
      ],
      land: [0, 176],
    },
    right: {
      towers: [
        { kind: 'hotel', x: 590, w: 28, top: 92, dir: 1 },
        { kind: 'deco', x: 650, w: 24, top: 60 },
      ],
      palms: [
        { x: 616, h: 56, lean: 8, frond: 22 },
        { x: 698, h: 66, lean: -10, frond: 24 },
      ],
      land: [566, 728],
    },
    shore: [[250, 290, 8], [380, 430, 12], [500, 530, 8]],
    kr: [[24, 108], [126, 108], [560, 108]],
    heli: [[36, 6, 38, 44, 'L'], [560, 22, 650, 62, 'R']],
    reachX: 0,
    reachK: 1.5,
  }
}

// ---------------------------------------------------------------- pixel bitmaps

const BODY = 1
const RIM = 2

/** A grid of pixels; each holds an ink number (0: empty). */
class Bitmap {
  readonly d: Uint8Array
  constructor(readonly w: number, readonly h: number) {
    this.d = new Uint8Array(w * h)
  }
  set(x: number, y: number, v: number) {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.d[y * this.w + x] ?? 0
  }
  rect(x0: number, y0: number, x1: number, y1: number, v: number) {
    for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) this.set(x, y, v)
  }
  /** Lay another bitmap's pixels over this one. */
  over(b: Bitmap) {
    for (let i = 0; i < this.d.length; i++) { const v = b.d[i] ?? 0; if (v) this.d[i] = v }
  }
}

/** One path for the pixels that pass `on`: runs along each row, merged downward while the run stays the same. */
function runs(w: number, h: number, on: (x: number, y: number) => boolean): string {
  type Run = { x: number; len: number; y: number; h: number }
  let open = new Map<number, Run>()
  let d = ''
  const emit = (r: Run) => { d += `M${r.x} ${r.y}h${r.len}v${r.h}h-${r.len}z` }
  for (let y = 0; y <= h; y++) {
    const next = new Map<number, Run>()
    let x = 0
    while (y < h && x < w) {
      if (!on(x, y)) { x++; continue }
      const s = x
      while (x < w && on(x, y)) x++
      const key = s * 8192 + (x - s)
      const run = open.get(key)
      if (run) { run.h++; next.set(key, run); open.delete(key) } else next.set(key, { x: s, len: x - s, y, h: 1 })
    }
    for (const r of open.values()) emit(r)
    open = next
  }
  return d
}
const runPath = (b: Bitmap, ink: number) => runs(b.w, b.h, (x, y) => b.get(x, y) === ink)

/** A tower as a plain silhouette: one body ink; the lit edge is added afterwards. */
function drawTower(b: Bitmap, t: Tower, ground: number) {
  const g = Math.round(ground / PX)
  const cx = Math.round(t.x / PX)
  const hw = Math.max(2, Math.round(t.w / PX / 2))
  const top = Math.round(t.top / PX)
  if (t.kind === 'deco') {
    const span = g - top
    const crown = top + Math.round(span * 0.27)
    b.rect(cx - hw, crown, cx + hw, g, BODY)
    // Setbacks: two pixels in on each side, a sixth of the crown's height each; then a fin and a needle spire.
    const step = Math.max(2, Math.round(span * 0.055))
    let w = hw - 2
    let y = crown
    let n = 0
    while (w >= 2 && n < 3) { b.rect(cx - w, y - step, cx + w, y, BODY); w -= 2; y -= step; n++ }
    const fin = Math.max(2, Math.round(step * 1.2))
    b.rect(cx - 1, y - fin, cx + 1, y, BODY)
    b.rect(cx - 1, top, cx, y - fin, BODY)
  } else if (t.kind === 'slab') {
    b.rect(cx - hw, top, cx + hw, g, BODY)
    b.rect(cx - hw + 1, top - 2, cx - hw + 4, top, BODY)
    b.rect(cx + hw - 2, top - 6, cx + hw - 1, top, BODY)
  } else {
    // Terraces: each level three pixels narrower on one side, four pixels tall.
    const levels = Math.max(1, Math.min(4, Math.floor((g - top) / 4) - 1))
    for (let i = 0; i < levels; i++) {
      const y0 = top + i * 4
      const cut = (levels - 1 - i) * 3
      const x0 = t.dir < 0 ? cx - hw + cut : cx - hw
      const x1 = t.dir < 0 ? cx + hw : cx + hw - cut
      b.rect(x0, y0, x1, i === levels - 1 ? g : y0 + 4, BODY)
    }
  }
}

/** The lit edge: the last body pixel of each row on the side that faces the sun. */
function litEdge(b: Bitmap, facing: 1 | -1) {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) if (b.get(x, y) === BODY && b.get(x + facing, y) === 0) b.set(x, y, RIM)
  }
}

/** A thin pixel line from (x0,y0) to (x1,y1), in pixel units. */
function line(b: Bitmap, x0: number, y0: number, x1: number, y1: number, v: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
  for (let i = 0; i <= n; i++) b.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, v)
}

/**
 * A palm. The trunk is a smooth curve on the 4-unit grid: two pixels wide, each row shifted at most one
 * pixel and always the same way; near the crown it thins to a one-pixel neck that stands on the middle of
 * the trunk under it. The crown: seven to nine fronds on a 2-unit grid that leave the top, arch and droop,
 * with leaflets hanging from their lower side. `trunk` is in pixels (what the water mirrors); `fine` is
 * the trunk as it is drawn, in half pixels like the fronds, so the neck can sit half a pixel in.
 */
function drawPalm(trunk: Bitmap, fine: Bitmap, fronds: Bitmap, p: Palm, ground: number, seed: number) {
  const bx = p.x / PX
  const by = Math.round(ground / PX) - 1
  const h = Math.round(p.h / PX)
  const lean = p.lean / PX
  const dir = lean >= 0 ? 1 : -1
  let prev = Math.round(bx)
  let topLo = prev
  for (let i = 0; i <= h; i++) {
    const t = i / h
    // A curve that leans more toward the top; the step per row is capped at one pixel.
    let x = Math.round(bx + lean * t * t)
    if (Math.abs(x - prev) > 1) x = prev + dir
    if ((x - prev) * dir < 0) x = prev
    prev = x
    // The left pixel of the two-pixel trunk in this row, and the row in half pixels.
    const lo = dir > 0 ? x - 1 : x
    const y2 = (by - i) * 2
    topLo = lo
    trunk.set(x, by - i, BODY)
    if (t < 0.86) {
      trunk.set(x + (dir > 0 ? -1 : 1), by - i, BODY)
      fine.rect(lo * 2, y2, lo * 2 + 4, y2 + 2, BODY)
    } else fine.rect(lo * 2 + 1, y2, lo * 2 + 3, y2 + 2, BODY)
  }
  // Fronds in half pixels, from the top of the neck.
  const F = PX / 2
  const cx = topLo * 2 + 2
  const cy = (by - h) * 2
  const len = p.frond / F
  const n = 7 + Math.floor(hash(seed, 1, 17) * 3)
  for (let i = 0; i < n; i++) {
    // A fan from just above the left horizontal to just above the right one.
    const u0 = i / (n - 1)
    const deg = 168 - u0 * 156 + (hash(i, seed, 7) - 0.5) * 8
    const a = (deg * Math.PI) / 180
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const reach = len * (0.84 + hash(i, seed, 3) * 0.2) * (1 - 0.3 * sa * sa)
    // Rise, then droop: the fall overtakes the climb past the first third, more for the side fronds.
    const droop = reach * (0.62 + 0.3 * Math.abs(ca))
    let px = cx
    let py = cy
    const steps = Math.ceil(reach)
    for (let s = 1; s <= steps; s++) {
      const u = s / steps
      const x = cx + ca * reach * u
      const y = cy - sa * reach * u + droop * u * u
      line(fronds, px, py, x, y, BODY)
      // The blade: a serrated lower edge, deepest at mid-frond, as leaflets seen from the side.
      const deep = Math.round((s % 2 === 0 ? 3.2 : 1.8) * Math.min(1, len / 26) * Math.sin(Math.PI * Math.min(1, u * 1.1)))
      for (let k = 1; k <= deep; k++) fronds.set(x - Math.sign(ca) * k * 0.3, y + k, BODY)
      px = x
      py = y
    }
  }
  fronds.rect(cx - 2, cy - 1, cx + 3, cy + 2, BODY)
  fronds.rect(cx - 1, cy + 2, cx + 2, cy + 3, BODY)
}

/**
 * The far shore: a land line one pixel thick across the whole water's edge, and clusters of low buildings
 * along it, stepped up toward the middle of each cluster and joined at the base.
 */
function drawShore(b: Bitmap, w: number, ground: number, clusters: readonly (readonly [number, number, number])[]) {
  const g = Math.round(ground / PX)
  b.rect(-1, g - 1, Math.ceil(w / PX) + 1, g, BODY)
  clusters.forEach(([x0, x1, tall], ci) => {
    const a = Math.round(x0 / PX)
    const z = Math.round(x1 / PX)
    const peak = Math.max(1, Math.round(tall / PX))
    let x = a
    let i = 0
    while (x < z) {
      const bw = Math.min(z - x, 3 + Math.floor(hash(i, ci, 51) * 4))
      const mid = (x + bw / 2 - a) / Math.max(1, z - a)
      const shape = Math.sin(Math.PI * clamp(mid))
      const hgt = Math.max(1, Math.min(peak, Math.round(1 + (peak - 1) * shape * (0.7 + 0.3 * hash(i, ci, 52)))))
      b.rect(x, g - 1 - hgt, x + bw, g - 1, BODY)
      x += bw
      i++
    }
  })
}

/** The ground under a side group: a low quay, one pixel above and one under the waterline. */
function drawLand(b: Bitmap, x0: number, x1: number, ground: number) {
  const g = Math.round(ground / PX)
  const a = Math.round(x0 / PX)
  const z = Math.round(x1 / PX)
  b.rect(a, g - 1, z, g, BODY)
  b.rect(a + 2, g, z - 2, g + 1, BODY)
}

// ---------------------------------------------------------------- the sun

/**
 * The sun's rows above the horizon (or the whole disc, by day): every row is centred on one pixel and
 * cut at the same rounded half-width both sides, so the two shoulders step alike. Miami slats are cut into
 * its lower half, widening toward the foot; `phase` walks them up one pixel.
 */
function sunPath(sun: { x: number; y: number; r: number }, horizon: number, phase: number, gaps = false): string {
  const sx = Math.round(sun.x / PX)
  const sy = sun.y / PX
  const r = sun.r / PX
  const foot = Math.min(Math.round(sy + r), Math.round(horizon / PX))
  const zoneTop = Math.round(foot - Math.min(r * 0.56, foot - (sy - r)))
  const big = r > 16
  const pattern = big ? [2, 2, 2, 3, 1, 3, 1, 4, 1, 99] : [1, 1, 1, 2, 1, 2, 1, 99]
  const isGap = (row: number) => {
    let k = foot - 1 - row + phase
    let gap = true
    for (const n of pattern) {
      if (k < n) return gap
      k -= n
      gap = !gap
    }
    return false
  }
  let d = ''
  for (let y = Math.round(sy - r); y < foot; y++) {
    const dy = y + 0.5 - sy
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) - 0.5)
    if (half < 1) continue
    if ((y >= zoneTop && isGap(y)) !== gaps) continue
    d += `M${sx - half} ${y}h${half * 2 + 1}v1h-${half * 2 + 1}z`
  }
  return d
}

/** The sun's broken reflection: dashes under it, rows spreading and thinning with depth. */
function reflectionPath(sun: { x: number; r: number }, horizon: number, bottom: number, seed: number, narrow: number): string {
  const sx = sun.x / PX
  const r = (sun.r / PX) * narrow
  const top = Math.round(horizon / PX) + 2
  const end = Math.round(bottom / PX)
  let d = ''
  let y = top
  let k = 0
  while (y < end) {
    const depth = (y - top) / (end - top)
    const hw = r * (1 - 0.55 * depth)
    let x = Math.round(sx - hw + hash(k, seed, 1) * 2)
    const stop = sx + hw
    let j = 0
    while (x < stop) {
      const len = 2 + Math.floor(hash(j, k, seed) * (7 - 4 * depth))
      const keep = hash(j, k, seed + 5) > 0.12 + 0.5 * depth
      const l = Math.min(len, Math.round(stop - x))
      if (keep && l > 0) d += `M${x} ${y}h${l}v1h-${l}z`
      x += len + 1 + Math.floor(hash(j, k, seed + 9) * (1 + 3 * depth))
      j++
    }
    y += 2 + Math.floor(depth * 3)
    k++
  }
  return d
}

/**
 * The moon, in pixels: a full disc, dim, and a rim along its right side that is a step brighter (what a
 * disc of the same size, moved a little left and down, leaves uncovered). Returns [the disc less the rim, the rim].
 */
function moonPaths(m: { x: number; y: number; r: number }): [string, string] {
  const b = new Bitmap(Math.ceil((m.x + m.r * 2) / PX) + 2, Math.ceil((m.y + m.r * 2) / PX) + 2)
  const cx = m.x / PX
  const cy = m.y / PX
  const r = m.r / PX
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy > r * r) continue
      b.set(x, y, (dx + r * 0.24) ** 2 + (dy - r * 0.1) ** 2 <= r * r ? BODY : RIM)
    }
  }
  return [runPath(b, BODY), runPath(b, RIM)]
}

/** The moon's broken path on the water under it: short dashes, fewer and shorter with depth. */
function moonTrail(m: { x: number }, horizon: number, bottom: number): string {
  let d = ''
  let k = 0
  for (let y = Math.round(horizon / PX) + 3; y < bottom / PX; y += 2 + (k % 2)) {
    const depth = (y * PX - horizon) / (bottom - horizon)
    const hw = 4 + depth * 5
    let x = Math.round(m.x / PX - hw + hash(k, 2, 61) * 2)
    let j = 0
    while (x < m.x / PX + hw) {
      const len = 1 + Math.floor(hash(j, k, 62) * 3)
      if (hash(j, k, 63) > 0.3 + 0.4 * depth) d += `M${x} ${y}h${len}v1h-${len}z`
      x += len + 1 + Math.floor(hash(j, k, 64) * 3)
      j++
    }
    k++
  }
  return d
}

// ---------------------------------------------------------------- the glow

type Field = (x: number, y: number) => number

/**
 * The glow printed through five inks in turn: ink k covers where the field passes k-1, as a Bayer
 * dither of 4-unit pixels with `steps` levels per ink. A tile fully covered is part of one solid path;
 * the rest is one path per level, filled with that level's one-tile pattern. All in tile units.
 */
function ditherGlow(field: Field, x0: number, y0: number, x1: number, y1: number, steps: number, pre: string, pats: Map<string, string>): string {
  const c0 = Math.floor(x0 / TILE)
  const r0 = Math.floor(y0 / TILE)
  const cols = Math.ceil(x1 / TILE) - c0
  const rows = Math.ceil(y1 / TILE) - r0
  const per = 16 / steps
  const tone = new Float32Array(cols * rows * steps)
  // Each level is sampled at the middle of its own pixels, so the dither follows the field inside a tile.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (let lv = 0; lv < steps; lv++) {
        let sx = 0
        let sy = 0
        for (let q = lv * per; q < (lv + 1) * per; q++) { const s = SPOT[q] ?? [0, 0]; sx += s[0]; sy += s[1] }
        const x = (c0 + c) * TILE + (sx / per + 0.5) * PX
        const y = (r0 + r) * TILE + (sy / per + 0.5) * PX
        // A little hashed jitter per tile, under one level, so no level change runs along a straight line
        // and no tile stands out from its neighbours as a slab.
        tone[(r * cols + c) * steps + lv] = field(x, y) + ((hash(c0 + c, r0 + r, 77) - 0.5) * 0.96) / steps
      }
    }
  }
  let out = ''
  for (let k = 1; k <= 5; k++) {
    const lit = (c: number, r: number, lv: number) => (tone[(r * cols + c) * steps + lv] ?? 0) - (k - 1) > (lv + 0.5) / steps
    const full = (c: number, r: number) => lit(c, r, steps - 1)
    const solid = runs(cols, rows, full)
    if (solid) out += `<path class="q${k}" d="${solid}"/>`
    for (let lv = 0; lv < steps; lv++) {
      const d = runs(cols, rows, (c, r) => lit(c, r, lv) && !full(c, r))
      if (!d) continue
      const id = `${pre}${k}${lv}`
      if (!pats.has(id)) {
        let pd = ''
        for (let q = lv * per; q < (lv + 1) * per; q++) {
          const [sx, sy] = SPOT[q] ?? [0, 0]
          pd += `M${num(sx / 4)} ${num(sy / 4)}h.25v.25h-.25z`
        }
        pats.set(id, `<pattern id="${id}" class="q${k}" width="1" height="1" patternUnits="userSpaceOnUse"><path d="${pd}"/></pattern>`)
      }
      out += `<path fill="url(#${id})" d="${d}"/>`
    }
  }
  return out ? `<g transform="translate(${c0 * TILE} ${r0 * TILE}) scale(${TILE})">${out}</g>` : ''
}

// ---------------------------------------------------------------- the glyph field

type Mark = { c: number; r: number; g: string }

/** How much of the reading column covers x (0..1), with soft edges. */
function inColumn(p: Plan, x: number): number {
  if (!p.calm) return 0
  return smooth(p.calm.x0 - 150, p.calm.x0, x) * (1 - smooth(p.calm.x1, p.calm.x1 + 200, x))
}

type Glyphs = { sky: Mark[]; skyWarm: Mark[]; shA: Mark[]; shB: Mark[] }

const SWAP: Record<string, string> = { '-': '=', '=': '-', '.': ':', ':': '.', '~': '-', '+': '*', '*': '+', "'": '.' }

/**
 * The glyph field over the sky: one mark per 8-unit cell where a density beats a hashed threshold. The
 * density never passes about half, so no part of the field fills every cell and reads as a lattice. High in
 * the sky: fine dots and crosses, sparse, thicker toward the sides; toward the horizon and the sun, dashes,
 * denser. Warm marks near the sun go to their own ink.
 */
function buildGlyphs(p: Plan, tod: TimeOfDay, near: Field, shimmer: readonly (readonly [number, number, number, number])[]): Glyphs {
  const cols = Math.ceil(p.w / CELL)
  const hr = Math.floor(p.horizon / CELL)
  const f: Glyphs = { sky: [], skyWarm: [], shA: [], shB: [] }
  const mid = p.calm ? (p.calm.x0 + p.calm.x1) / 2 : p.w * 0.55
  for (let r = 0; r < hr - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CELL + CELL / 2
      const y = r * CELL + CELL / 2
      const t = hash(c, r, 1)
      const u = hash(c, r, 2)
      // Toward the sides: 0 over the middle of the column, 1 at the frame.
      const side = clamp(Math.abs(x - mid) / (p.w * 0.5)) ** 1.3
      const glow = clamp(near(x, y))
      // Nothing is printed inside the sun's disc or the moon's, so the sun's slats show only the glow.
      if (p.sun && (x - p.sun.x) ** 2 + (y - p.sun.y) ** 2 < (p.sun.r + 8) ** 2) continue
      if (p.moon && (x - p.moon.x) ** 2 + (y - p.moon.y) ** 2 < (p.moon.r + 10) ** 2) continue
      const v = clamp(y / p.horizon)
      let dens = (0.05 + 0.09 * v * v + 0.12 * v ** 6) * (0.55 + 1.5 * side) + 0.16 * glow
      let cloud = 0
      for (const [cy, x0, x1] of p.clouds) {
        const d = (y - cy - Math.sin(x / 140 + cy) * 6) / 9
        const along = smooth(x0, x0 + (x1 - x0) * 0.3, x) * (1 - smooth(x1 - (x1 - x0) * 0.3, x1, x))
        cloud = Math.max(cloud, Math.exp(-d * d) * along)
      }
      if (tod !== 'night') dens += 0.3 * cloud
      dens = Math.min(0.46, dens)
      if (t >= dens) continue
      const low = y > p.horizon - p.h * 0.22
      let g: string
      if (cloud > 0.3 && tod !== 'night') g = u < 0.3 ? '~' : '-'
      else if (low) g = u < 0.45 ? '-' : u < 0.75 ? '.' : '='
      else g = u < 0.3 ? '.' : u < 0.5 ? "'" : u < 0.75 ? ':' : u < 0.92 ? '+' : '*'
      const warm = glow > 0.2 && hash(c, r, 5) < glow * 1.2
      const m: Mark = { c, r, g }
      const region = shimmer.findIndex(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)
      const alt = SWAP[g]
      if (region >= 0 && alt !== undefined && !warm && hash(c, r, 8) < 0.5) {
        f.shA.push(m)
        f.shB.push({ c, r, g: alt })
        continue
      }
      ;(warm ? f.skyWarm : f.sky).push(m)
    }
  }
  return f
}

/**
 * Marks written as <text> elements at their real size: an x list per glyph, one y for the first glyph and
 * a dy list that steps down where a row changes. Rows are packed into elements of about `per` glyphs.
 */
function glyphTexts(marks: readonly Mark[], attrs: string, per = 400): string {
  const sorted = [...marks].sort((a, b) => a.r - b.r || a.c - b.c)
  let out = ''
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length) {
      const row = sorted[j]?.r ?? 0
      let k = j
      while (k < sorted.length && (sorted[k]?.r ?? -1) === row) k++
      if (j > i && k - i > per) break
      j = k
    }
    const chunk = sorted.slice(i, j)
    const first = chunk[0]
    if (!first) break
    const xs: number[] = []
    const dys: number[] = []
    let text = ''
    let prev = first.r
    for (const m of chunk) {
      xs.push(m.c * CELL + CELL / 2)
      dys.push((m.r - prev) * CELL)
      prev = m.r
      text += m.g === "'" ? '&#39;' : m.g
    }
    while (dys.length > 0 && dys[dys.length - 1] === 0) dys.pop()
    const dy = dys.length > 0 ? ` dy="${dys.join(' ')}"` : ''
    out += `<text x="${xs.join(' ')}" y="${first.r * CELL + 7}"${dy}${attrs}>${text}</text>`
    i = j
  }
  return out
}

/** A silhouette's broken mirror image in the water: pixel dashes on every other row, thinning with depth. */
function mirrorPath(p: Plan, maps: readonly Bitmap[], x0: number, x1: number, deep: number): string {
  const g = Math.round(p.horizon / PX)
  const end = Math.min(Math.round(p.h / PX), g + Math.round(deep / PX))
  const b = new Bitmap(Math.ceil(p.w / PX) + 2, Math.ceil(p.h / PX) + 2)
  for (let y = g + 1; y < end; y++) {
    if ((y - g) % 2 === 0) continue
    const depth = (y - g) / (end - g)
    const my = 2 * g - 1 - y
    const wob = Math.round((hash(y, 3, 71) - 0.5) * 2)
    for (let x = Math.floor(x0 / PX); x < Math.ceil(x1 / PX); x++) {
      if (!maps.some(m => m.get(x + wob, my) !== 0)) continue
      if (hash(Math.floor(x / 3), y, 72) < 0.15 + depth * 0.7) continue
      b.set(x, y, BODY)
    }
  }
  return runPath(b, BODY)
}

// ---------------------------------------------------------------- dots

/** Zero-length round-capped strokes, one path: `M x y h0`, relative along a row. */
function dotPath(dots: readonly (readonly [number, number])[]): string {
  const sorted = [...dots].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  let d = ''
  let last: readonly [number, number] | null = null
  for (const dot of sorted) {
    d += last !== null && last[1] === dot[1] ? `m${dot[0] - last[0]} 0h0` : `M${dot[0]} ${dot[1]}h0`
    last = dot
  }
  return d
}

/** Lit windows on tower bodies: pixel centres on a two-by-three lattice, a hashed share of them lit. */
function windows(b: Bitmap, density: number, seed: number, pinkShare: number): [number, number][][] {
  const sets: [number, number][][] = [[], [], []]
  if (density <= 0) return sets
  for (let y = 0; y < b.h; y++) {
    if (y % 3 !== 1) continue
    for (let x = 0; x < b.w; x++) {
      if (x % 2 !== 0) continue
      if (b.get(x, y) !== BODY || b.get(x, y - 2) === 0 || b.get(x - 1, y) === 0 || b.get(x + 1, y) === 0 || b.get(x, y + 3) === 0) continue
      if (hash(x, y, seed) >= density) continue
      const v = hash(x, y, seed + 1)
      sets[v < pinkShare ? 0 : v < 0.94 ? 1 : 2]?.push([x * PX + PX / 2, y * PX + PX / 2])
    }
  }
  return sets
}

// ---------------------------------------------------------------- the game's heat

/** Patrol light pairs on the waterline: a red and a blue pixel and their short reflections. */
function patrol(p: Plan, heat: number, flash: boolean): string {
  if (heat < 3) return ''
  const pairs = p.kr.slice(0, heat >= 4 ? 3 : 2)
  const one = ([x, y]: readonly [number, number]) =>
    `M${x - 6} ${y - 4}h4v3h-4z|M${x + 2} ${y - 4}h4v3h-4z|M${x - 6} ${y + 6}h4v1h-4zM${x - 5} ${y + 12}h2v1h-2z|M${x + 2} ${y + 6}h4v1h-4zM${x + 3} ${y + 12}h2v1h-2z`
  const parts = pairs.map(one).map(s => s.split('|'))
  const join = (i: number) => parts.map(q => q[i] ?? '').join('')
  const inner = `<path d="${join(0)}" fill="${RED}"/><path d="${join(1)}" fill="${BLUE}"/><path d="${join(2)}" fill="${RED}" opacity=".5"/><path d="${join(3)}" fill="${BLUE}" opacity=".5"/>`
  return `<g class="kr">${flash ? `<g class="cr">${inner}</g>` : inner}</g>`
}

/** A helicopter in pixels, with its searchlight: a clean stepped cone in one flat ink and a brighter core. */
const HELI = [
  '.##########..',
  '......#......',
  '....######...',
  '##.########..',
  '#..#######.#.',
  '....######...',
  '....#....#...',
  '...########..',
]
function heli(x: number, y: number, tx: number, ty: number, n: number, scale: number): string {
  let d = ''
  HELI.forEach((row, j) => {
    let i = 0
    while (i < row.length) {
      if (row[i] !== '#') { i++; continue }
      const s = i
      while (row[i] === '#') i++
      d += `M${s} ${j}h${i - s}v1h${s - i}z`
    }
  })
  const k = PX * scale
  const ax = (x + 6 * k) / PX
  const ay = Math.round((y + 8 * k) / PX)
  const ty4 = Math.round(ty / PX)
  let beam = ''
  let core = ''
  for (let row = ay; row < ty4; row++) {
    const t = (row - ay) / Math.max(1, ty4 - ay)
    const cx = ax + (tx / PX - ax) * t
    const hw = 0.5 + (scale < 1 ? 2.5 : 4.5) * t
    const a = Math.round(cx - hw)
    const b = Math.round(cx + hw)
    if (b > a) beam += `M${a} ${row}h${b - a}v1h${a - b}z`
    core += `M${Math.round(cx - 0.5)} ${row}h1v1h-1z`
  }
  return `<g class="heli h${n}"><path class="sl sm" transform="scale(${PX})" d="${beam}"/><path class="sl sc" transform="scale(${PX})" d="${core}"/><path transform="translate(${x} ${y}) scale(${k})" d="${d}" class="c1"/><path d="M${x + 10 * k} ${y + 4 * k + 2}h0" class="hl"/></g>`
}

/** The banner's sky, cut into hover regions: nine columns by three bands, at most 27 groups. */
function hoverGroups(field: Glyphs, k: string, kw: string): string {
  const groups = new Map<number, { cool: Mark[]; warm: Mark[] }>()
  const add = (m: Mark, warm: boolean) => {
    const key = Math.floor(m.c / 10) * 3 + Math.min(2, Math.floor(m.r / 5))
    let g = groups.get(key)
    if (!g) { g = { cool: [], warm: [] }; groups.set(key, g) }
    ;(warm ? g.warm : g.cool).push(m)
  }
  for (const m of field.sky) add(m, false)
  for (const m of field.skyWarm) add(m, true)
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => `<g class="b">${glyphTexts(g.cool, k, 999)}${glyphTexts(g.warm, kw, 999)}</g>`).join('')
}

// ---------------------------------------------------------------- assembly

type Built = { defs: string; body: string; rules: string[] }

function scene(p: Plan, tod: TimeOfDay, heat: number, flash: boolean, pre: string, strip: boolean): Built {
  const H = p.horizon
  const ground = H
  const bw = Math.ceil(p.w / PX) + 2
  const bh = Math.ceil(p.h / PX) + 2
  const lt = LIGHT[tod]
  const sun = p.sun

  // ---- the glow: one smooth function of x and y, centred on the sun.
  // Across: full at the sun, falling off to the right and keeping `far` of itself at the far edge.
  const gx = p.gx
  const spread = p.w * 0.38
  const across = (x: number) => lt.far + (1 - lt.far) * Math.exp(-(((x - gx) / spread) ** 2))
  // Up: the band climbs higher over the sun than at the far side, a low dome.
  const reach0 = Math.min(H, H * lt.reach * p.reachK)
  const sr = sun ? sun.r : strip ? 40 : 100
  const gy = sun ? Math.min(sun.y, H) : H
  const halo = (x: number, y: number) =>
    sun ? lt.sun * Math.exp(-((x - gx) ** 2) / (2 * (sr * 1.7) ** 2) - ((y - gy) ** 2) / (2 * (sr * (tod === 'day' ? 1.5 : 1.1)) ** 2)) : 0
  const sky: Field = (x, y) => {
    const a = across(x)
    const reach = reach0 * (0.55 + 0.45 * a)
    const ramp = Math.pow(clamp(1 - (H - y) / reach), 1.7)
    return lt.band * (strip ? 0.78 : 1) * a * ramp + halo(x, y)
  }
  // Down: the water carries the glow at the horizon, easing to SEA_FOOT of it at the bottom edge.
  const field: Field = (x, y) => {
    if (y < H) return sky(x, y)
    const d = clamp((y - H) / (p.h - H))
    return sky(x, H - 0.01) * (1 - (1 - SEA_FOOT) * d)
  }
  const pats = new Map<string, string>()
  const glowTop = Math.max(0, H - reach0 - 32)
  const glow = ditherGlow(field, -TILE - p.reachX, glowTop, p.w + TILE, p.h, strip ? 16 : 8, pre, pats)

  // ---- the side groups: towers lit on the side that faces the sun, palms on their own ground.
  const side = (s: Side, seed: number) => {
    const body = new Bitmap(bw, bh)
    const fronds = new Bitmap(bw * 2, bh * 2)
    const trunks = new Bitmap(bw, bh)
    const fine = new Bitmap(bw * 2, bh * 2)
    for (const t of s.towers) {
      const one = new Bitmap(bw, bh)
      drawTower(one, t, ground)
      litEdge(one, t.x < gx ? 1 : -1)
      body.over(one)
    }
    const towers = new Bitmap(bw, bh)
    towers.d.set(body.d)
    s.palms.forEach((palm, i) => drawPalm(trunks, fine, fronds, palm, ground, seed + i))
    drawLand(body, s.land[0], s.land[1], ground)
    return { body, fronds, towers, trunks, fine }
  }
  const L = side(p.left, 1)
  const R = side(p.right, 5)
  const far = new Bitmap(bw, bh)
  drawShore(far, p.w, ground, p.shore)

  // Shimmer regions trade two glyph variants: the sky at both sides, away from the words.
  const shimmer: (readonly [number, number, number, number])[] = strip
    ? [[0, 0, 60, H], [560, 0, 720, H]]
    : [[0, 120, 180, H - 200], [1250, 120, 1600, H]]
  const near: Field = (x, y) => (sun ? halo(x, y) / Math.max(0.01, lt.sun) : 0.5 * Math.exp(-(((x - gx) / 260) ** 2) - (((y - H) / 120) ** 2)))
  const glyphs = buildGlyphs(p, tod, near, shimmer)

  // Lit windows: few and warm by day's end, more by night, with neon pink among them.
  const lit = { dawn: 0.05, day: 0, sunset: 0.09, night: 0.32 }[tod]
  const wl = windows(L.towers, lit, 3, tod === 'night' ? 0.4 : 0.15)
  const wr = windows(R.towers, lit * 0.6, 9, tod === 'night' ? 0.4 : 0.15)

  const defs =
    // The glyphs' colour: a vertical ramp from the high sky to the horizon.
    `<linearGradient id="${pre}k" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">` +
    `<stop offset=".36" style="stop-color:var(--k1)"/><stop offset=".8" style="stop-color:var(--k2)"/><stop offset="1" style="stop-color:var(--k3)"/></linearGradient>` +
    (sun
      ? `<linearGradient id="${pre}s" gradientUnits="userSpaceOnUse" x1="0" y1="${(sun.y - sun.r) / PX}" x2="0" y2="${Math.min(sun.y + sun.r, H) / PX}"><stop offset=".15" style="stop-color:var(--sa)"/><stop offset="1" style="stop-color:var(--sb)"/></linearGradient>` +
        // The reflection fades with depth.
        `<linearGradient id="${pre}r" gradientUnits="userSpaceOnUse" x1="0" y1="${H / PX}" x2="0" y2="${p.h / PX}"><stop offset="0" style="stop-color:var(--sb)"/><stop offset="1" style="stop-color:var(--sb);stop-opacity:.15"/></linearGradient>`
      : '') +
    [...pats.values()].join('') +
    // The reading column: the glyph field alone is printed at reduced strength there.
    (p.calm
      ? `<linearGradient id="${pre}m1" gradientUnits="userSpaceOnUse" x2="${p.w}">` +
        `<stop offset="${num((p.calm.x0 - 150) / p.w)}" stop-color="#fff"/><stop offset="${num((p.calm.x0 - 70) / p.w)}" stop-color="#999"/><stop offset="${num(p.calm.x0 / p.w)}" stop-color="#555"/>` +
        `<stop offset="${num((p.calm.x1 + 175) / p.w)}" stop-color="#555"/><stop offset="${num((p.calm.x1 + 225) / p.w)}" stop-color="#999"/><stop offset="${num((p.calm.x1 + 270) / p.w)}" stop-color="#fff"/></linearGradient>` +
        `<mask id="${pre}m" maskUnits="userSpaceOnUse" x="-400" y="0" width="${p.w + 800}" height="${H}"><rect x="-400" width="${p.w + 800}" height="${H}" fill="url(#${pre}m1)"/></mask>`
      : '')

  const k = ` fill="url(#${pre}k)"`
  const kw = ' class="kw"'

  // Stars (night and dawn): fine dots high in the sky, none over the column.
  let stars = ''
  if (tod === 'night' || tod === 'dawn') {
    const a: [number, number][] = []
    const b2: [number, number][] = []
    for (let r = 1; r < (H - 200) / CELL; r++) {
      for (let c = 0; c < p.w / CELL; c++) {
        const x = c * CELL + 4
        const col = inColumn(p, x)
        const chance = (tod === 'night' ? 0.045 : 0.018) * (1 - col) * (1 - smooth(H - 400, H - 200, r * CELL))
        if (hash(c, r, 41) >= chance) continue
        const dot: [number, number] = [x + Math.round(hash(c, r, 42) * 3), r * CELL + Math.round(hash(c, r, 43) * 4)]
        if (p.moon && Math.hypot(dot[0] - p.moon.x, dot[1] - p.moon.y) < p.moon.r + 12) continue
        ;(hash(c, r, 44) < 0.3 ? b2 : a).push(dot)
      }
    }
    stars = `<path class="st" d="${dotPath(a)}"/><path class="st tw" d="${dotPath(b2)}"/>`
  }

  const gL = strip ? '' : ' class="gL"'
  const gR = strip ? '' : ' class="gR"'
  const skyMarks =
    `<g class="sky">${stars}${strip ? hoverGroups(glyphs, k, kw) : glyphTexts(glyphs.sky, k)}${glyphTexts(glyphs.skyWarm, kw)}</g>` +
    `<g class="shA">${glyphTexts(glyphs.shA, k, 600)}</g><g class="shB">${glyphTexts(glyphs.shB, k, 600)}</g>`

  const path = (b: Bitmap, ink: number, cls: string, scale = PX) => {
    const d = runPath(b, ink)
    return d ? `<path class="${cls}" transform="scale(${scale})" d="${d}"/>` : ''
  }
  const dots = (sets: [number, number][][]) => sets.map((s, i) => (s.length ? `<path class="w${i + 1}" d="${dotPath(s)}"/>` : '')).join('')
  const pathD = (d: string, cls: string) => (d ? `<path class="${cls}" transform="scale(${PX})" d="${d}"/>` : '')

  const deep = strip ? 30 : 150
  const mL = pathD(mirrorPath(p, [L.body, L.trunks], p.left.land[0], p.left.land[1], deep), 'mi')
  const mR = pathD(mirrorPath(p, [R.body, R.trunks], p.right.land[0], p.right.land[1], deep), 'mi')
  const mF = pathD(mirrorPath(p, [far], 0, p.w, strip ? 8 : 24), 'mf')

  // The sun in two frames that take turns slowly: the slats walk up a pixel and the reflection moves one pixel over.
  let sunParts = ''
  if (sun) {
    const refl = reflectionPath(sun, H, p.h, 3, tod === 'day' ? 0.45 : 0.6)
    const rf = `<path class="rf" transform="scale(${PX})" d="${refl}"/>`
    sunParts =
      `<g class="sA"><path class="sg" transform="scale(${PX})" d="${sunPath(sun, H, 0, true)}"/><path class="su" transform="scale(${PX})" d="${sunPath(sun, H, 0)}"/>${rf}</g>` +
      `<g class="sB"><path class="sg" transform="scale(${PX})" d="${sunPath(sun, H, 1, true)}"/><path class="su" transform="scale(${PX})" d="${sunPath(sun, H, 1)}"/><g transform="translate(${PX} 0)">${rf}</g></g>`
  }
  let moon = ''
  if (p.moon) {
    const [disc, rim] = moonPaths(p.moon)
    moon = `<path class="mo md" transform="scale(${PX})" d="${disc}"/><path class="mo" transform="scale(${PX})" d="${rim}"/><path class="mo mt" transform="scale(${PX})" d="${moonTrail(p.moon, H, p.h)}"/>`
  }

  const helis = p.heli.slice(0, heat >= 5 ? 2 : heat >= 4 ? 1 : 0)
  const hs = strip ? 0.5 : 1
  const heliOf = (s: 'L' | 'R') => helis.map((h, i) => (h[4] === s ? heli(h[0], h[1], h[2], h[3], i + 1, hs) : '')).join('')

  const mask = p.calm ? ` mask="url(#${pre}m)"` : ''
  const palms = (S: typeof L) => `${path(S.fine, BODY, 'p1', PX / 2)}<g class="sw">${path(S.fronds, BODY, 'p1', PX / 2)}</g>`
  const body =
    `<rect width="${p.w}" height="${p.h}" class="s0"/>` +
    `<g${gL}>${glow}${moon}</g>` +
    `<g${mask}>${skyMarks}</g>` +
    `${path(far, BODY, 'c0')}${mF}` +
    `<g${gR}>${mR}${path(R.body, BODY, 'c1')}${path(R.body, RIM, 'c2')}${palms(R)}${dots(wr)}${heliOf('R')}</g>` +
    `<g${gL}>${sunParts}${mL}${path(L.body, BODY, 'c1')}${path(L.body, RIM, 'c2')}${palms(L)}${dots(wl)}${heliOf('L')}</g>` +
    patrol(p, heat, flash)

  const rules = [
    `text{font:600 9px ${MONO};text-anchor:middle}`,
    '.s0{fill:var(--s0)}.q1{fill:var(--q1)}.q2{fill:var(--q2)}.q3{fill:var(--q3)}.q4{fill:var(--q4)}.q5{fill:var(--q5)}',
    '.c0,.mf{fill:var(--c0)}.c1,.mi{fill:var(--c1)}.c2{fill:var(--c2)}.p1{fill:var(--p1)}.mo{fill:var(--mo)}.md{opacity:.88}.mt{opacity:.7}.kw{fill:var(--k4)}',
    '.mi{fill-opacity:.55}.mf{fill-opacity:.5}',
    sun ? `.sg{fill:var(--sg)}.su{fill:url(#${pre}s)}.rf{fill:url(#${pre}r)}` : '',
    '.w1,.w2,.w3{opacity:var(--wo)}.w1,.w2,.w3,.st,.hl{fill:none;stroke-linecap:round}.w1{stroke:var(--w1);stroke-width:2.4}.w2{stroke:var(--w2);stroke-width:2.4}.w3{stroke:var(--w3);stroke-width:2.4}',
    `.st{stroke:var(--st);stroke-width:2}.hl{stroke:${RED};stroke-width:3;opacity:.8}.sl{fill:var(--sl)}.sm{opacity:.14}.sc{opacity:.3}`,
    // The rest frame: variant B of every pair is hidden until its animation shows it.
    '.sB,.shB{opacity:0}',
    // Slow motion only: every frame holds ten seconds or more.
    '.sA{animation:a1 20s steps(1) infinite}.sB{animation:a2 20s steps(1) infinite}',
    '.sw{animation:sw 26s steps(1) infinite}',
    '.shA{animation:a1 24s steps(1) infinite}.shB{animation:a2 24s steps(1) infinite}',
    '.tw{animation:tw 30s steps(1) infinite}',
    '.heli{animation:hv 40s steps(4) infinite alternate}.h2{animation-duration:48s;animation-direction:alternate-reverse}',
    // A heat flash: the patrol lights blink three times, each state held two seconds: an alert, not a strobe.
    '.cr{animation:bl 4s steps(1) 3}',
  ]
  return { defs, body, rules }
}

const KEYFRAMES =
  '@keyframes a1{0%{opacity:1}50%,100%{opacity:0}}@keyframes a2{0%{opacity:0}50%,100%{opacity:1}}' +
  '@keyframes sw{0%{transform:translate(0,0)}50%,100%{transform:translate(2px,0)}}' +
  '@keyframes tw{0%{opacity:1}50%,100%{opacity:.35}}' +
  '@keyframes hv{0%{transform:translate(0,0)}100%{transform:translate(24px,-8px)}}' +
  '@keyframes bl{50%{opacity:.08}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

function rootVars(tod: TimeOfDay, stock: Stock, sel: string): string {
  const set = INKS[tod]
  if (stock === 'light') return `${sel}{${vars(set.light)}}`
  if (stock === 'dark') return `${sel}{${vars(set.dark)}}`
  return `${sel}{${vars(set.dark)}}@media (prefers-color-scheme:light){${sel}{${vars(set.light)}}}`
}

/**
 * On narrow boxes the picture is cut at both sides. The left group, its sun and the glow centred on it step
 * right by what is cut at the next breakpoint, so the tower (whose left wall is at x 8) keeps its margin at
 * the left edge all the way down to it; the right group steps in, and goes in an upright box. The first,
 * small step is for a box only a little narrower than the picture, where a big step would carry the sun
 * under the words. The last holds down to a phone 45 wide to 100 tall.
 */
const NARROW =
  '@media (max-aspect-ratio:63/40){.gL{transform:translateX(16px)}}' +
  '@media (max-aspect-ratio:31/20){.gL{transform:translateX(76px)}.gR{transform:translateX(-60px)}}' +
  '@media (max-aspect-ratio:29/20){.gL{transform:translateX(152px)}.gR{transform:translateX(-130px)}}' +
  '@media (max-aspect-ratio:13/10){.gL{transform:translateX(228px)}.gR{transform:translateX(-200px)}}' +
  '@media (max-aspect-ratio:23/20){.gL{transform:translateX(304px)}.gR{transform:translateX(-280px)}}' +
  '@media (max-aspect-ratio:1/1){.gL{transform:translateX(404px)}.gR{opacity:0}}' +
  '@media (max-aspect-ratio:4/5){.gL{transform:translateX(576px)}}'

export function backdropSvg(tod: TimeOfDay, stock: Stock, heat = 0, flash = false): string {
  const p = backdropPlan(tod)
  const s = scene(p, tod, Math.max(0, Math.min(5, Math.round(heat))), flash, 'vd', false)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMax slice">` +
    `<style>${rootVars(tod, stock, 'svg')}${s.rules.join('')}${KEYFRAMES}${NARROW}</style>` +
    `<defs>${s.defs}</defs>${s.body}</svg>`
  )
}

/**
 * The banner: the same scene pulled into 720x160 at the same grain. Every rule is scoped under its id, so
 * two banners and a backdrop can share one document. Its sky is cut into regions that light up under the
 * pointer and fade back slowly.
 */
export function stripSvg(tod: TimeOfDay, stock: Stock, id = 'vs', heat = 0): string {
  const p = stripPlan(tod)
  const pre = id.replace(/[^A-Za-z0-9_-]/g, '') || 'vs'
  const s = scene(p, tod, Math.max(0, Math.min(5, Math.round(heat))), false, pre, true)
  const scope = (rule: string) => {
    const at = rule.indexOf('{')
    return `${rule.slice(0, at).split(',').map(sel => `#${pre} ${sel}`).join(',')}${rule.slice(at)}`
  }
  const rules = s.rules.map(r => r.split('}').filter(Boolean).map(x => scope(`${x}}`)).join('')).join('')
  const hover = `#${pre} .b{pointer-events:bounding-box}#${pre} .b text{fill-opacity:.62;transition:fill-opacity 2.6s ease-out}#${pre} .b:hover text{fill-opacity:1;fill:var(--h);transition:none}`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" id="${pre}" viewBox="0 0 720 160" width="720" height="160">` +
    `<style>${rootVars(tod, stock, `#${pre}`)}${rules}${KEYFRAMES}${hover}</style>` +
    `<defs>${s.defs}<clipPath id="${pre}q"><rect width="720" height="160" rx="14"/></clipPath></defs>` +
    `<g clip-path="url(#${pre}q)">${s.body}</g></svg>`
  )
}
