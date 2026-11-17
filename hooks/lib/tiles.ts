// Miami at dusk on a cell grid. One technique for every picture the mod has: the backdrop
// behind the desktop window, the banner of the welcome card, the busted banner, the icon
// and the terminal's pixels.
//
// The sky is a field of glyphs that brightens toward the horizon, so the sunset is drawn in
// characters; the city, the palms and the slatted sun are square tiles, so the silhouette
// stays clear. The field answers the pointer where a surface lets it through (CSS :hover,
// no script) and a slow wave walks through it where it does not.
//
// Pure string building, the same every time: shapes are drawn from geometry and
// rasterised onto the grid.

import type { TimeOfDay } from './time'

export const CELL = 16

/** The stock a scene is printed on: light paper for a light window, dark for a dark one. */
export type Paper = 'light' | 'dark'
/** `auto` lets the picture follow the window by itself (prefers-color-scheme inside the SVG). */
export type Stock = 'auto' | Paper

/** A tile: its cell and the letter of its paint. */
export type Tile = readonly [x: number, y: number, kind: string]

/**
 * One stock and its inks.
 * `s0`/`s1`: the paper, top and foot. `g1`/`g2`: the glow that rises from the horizon.
 * `f1`..`f3`: the glyphs of the sky, top to horizon. `a`/`b`/`c`: the sun, crown to foot,
 * `ga` its glyph. `i`: the silhouette (city, palms), `f`: the far city, `l`: cloud bars,
 * each with its glyph (`gi`, `gf`, `gl`). `sea`: the water. `w1`..`w3`: lit windows.
 * `h`: what a glyph turns to under the pointer.
 */
type Inks = {
  s0: string; s1: string; g1: string; g2: string; f1: string; f2: string; f3: string
  a: string; b: string; c: string; ga: string; i: string; gi: string; f: string; gf: string
  l: string; gl: string; sea: string; w1: string; w2: string; w3: string; h: string
  /** How strongly the glyphs of the sky print on this stock. */
  k: number
}

/** How strong the glow is at its middle and at the horizon: dark stock takes more light than paper. */
const GLOW: Record<Paper, readonly [number, number]> = { dark: [0.5, 0.92], light: [0.3, 0.7] }

/**
 * The backdrop stands behind the words of a conversation, wherever its column happens to
 * be, so it is printed quieter than a banner: the glow lower, the sun at part strength,
 * and on light paper a pale silhouette, since dark words cannot be read on a dark city.
 * `so` is the sun's strength; `i`/`gi`/`f`/`gf` replace the banner's silhouette inks.
 */
const AMBIENT: Record<Paper, { glow: readonly [number, number]; so: number; inks: Partial<Inks> }> = {
  dark: { glow: [0.32, 0.56], so: 0.34, inks: {} },
  light: { glow: [0.3, 0.6], so: 0.6, inks: { i: '#c3aed9', gi: '#a892c4', f: '#dccdea', gf: '#c9b8de', w1: '#e9a3c9', w2: '#93cfd1', w3: '#efc27a' } },
}

const INKS: Record<TimeOfDay, Record<Paper, Inks>> = {
  dawn: {
    dark: { s0: '#151126', s1: '#22142e', g1: '#8a3fb0', g2: '#ff9a7a', f1: '#5a55a8', f2: '#b65aa8', f3: '#ffa889', a: '#ffe3b0', b: '#ffb48a', c: '#f27a9a', ga: '#b85a6a', i: '#0c0916', gi: '#2c2248', f: '#2a2350', gf: '#3f3672', l: '#6a4a8a', gl: '#8f6ab0', sea: '#120d20', w1: '#ff5fa2', w2: '#5ce1e6', w3: '#ffd27a', h: '#fff1f8', k: 1 },
    light: { s0: '#f4eae8', s1: '#fbdfd2', g1: '#f2a0c0', g2: '#ffc49a', f1: '#b3a2d6', f2: '#e294bd', f3: '#f2a37a', a: '#ffe0a0', b: '#ffb890', c: '#f48aa8', ga: '#fff0e0', i: '#43306a', gi: '#7560a0', f: '#bcaad8', gf: '#d8cbea', l: '#ffffff', gl: '#f2d5e0', sea: '#efdcdc', w1: '#e0358a', w2: '#1fa3a8', w3: '#e89a1c', h: '#d6247a', k: 1.7 },
  },
  day: {
    dark: { s0: '#141024', s1: '#201230', g1: '#b0409a', g2: '#ffb347', f1: '#5f55b0', f2: '#c24aa0', f3: '#ffb46a', a: '#fff0b8', b: '#ffd27a', c: '#ff9a5c', ga: '#b8763a', i: '#0b0816', gi: '#2a1e48', f: '#2b1f4c', gf: '#40306c', l: '#6d3f8a', gl: '#9560b0', sea: '#110b1e', w1: '#ff5fa2', w2: '#5ce1e6', w3: '#ffd27a', h: '#fff1f8', k: 1 },
    light: { s0: '#f1ecf2', s1: '#fbe9dc', g1: '#b9c8f0', g2: '#ffd0a0', f1: '#a9aede', f2: '#d49ad4', f3: '#f0ab7c', a: '#fff3c0', b: '#ffd98a', c: '#ffb070', ga: '#fff8e0', i: '#3d2c66', gi: '#6f5c9c', f: '#b5a8d6', gf: '#d5cceb', l: '#ffffff', gl: '#e6def2', sea: '#e9e2ee', w1: '#e0358a', w2: '#1fa3a8', w3: '#e89a1c', h: '#d6247a', k: 1.7 },
  },
  sunset: {
    dark: { s0: '#140e22', s1: '#1d1029', g1: '#c2188f', g2: '#ff7a3d', f1: '#6c4fb0', f2: '#d0349a', f3: '#ff8a5c', a: '#ffd27a', b: '#ff8a5c', c: '#f0468c', ga: '#a8324f', i: '#0b0714', gi: '#2a1c44', f: '#2a1a47', gf: '#3d2a63', l: '#7a2d7d', gl: '#a54aa0', sea: '#100a1c', w1: '#ff5fa2', w2: '#5ce1e6', w3: '#ffd27a', h: '#fff1f8', k: 1 },
    light: { s0: '#f3e6e4', s1: '#f7d9cf', g1: '#f08ab4', g2: '#ffb07a', f1: '#b09ad2', f2: '#e07fb2', f3: '#ee905e', a: '#ffb85c', b: '#ff8f5e', c: '#ee5f95', ga: '#ffe2c8', i: '#3a2456', gi: '#6a4f8f', f: '#b59fd0', gf: '#d3c3e6', l: '#fbd0dc', gl: '#f0a8c0', sea: '#edd5d8', w1: '#e0358a', w2: '#1fa3a8', w3: '#e89a1c', h: '#d6247a', k: 1.7 },
  },
  night: {
    dark: { s0: '#0f0b1c', s1: '#150d22', g1: '#7a1fa0', g2: '#e0358a', f1: '#4d3d8f', f2: '#9a3ab8', f3: '#f0468c', a: '#fbe9c8', b: '#f3cfa5', c: '#e9a8a0', ga: '#b08a80', i: '#07050e', gi: '#1f1535', f: '#1f1538', gf: '#2f2152', l: '#3a2a66', gl: '#55408a', sea: '#0b0816', w1: '#ff5fa2', w2: '#5ce1e6', w3: '#ffd27a', h: '#ffffff', k: 1 },
    light: { s0: '#ebe6f0', s1: '#e6dcea', g1: '#c0a8e0', g2: '#f0a0c8', f1: '#a090cc', f2: '#c084c4', f3: '#e07ca8', a: '#fff6dc', b: '#f6e2b8', c: '#f0c8b0', ga: '#fffaf0', i: '#33254f', gi: '#64528a', f: '#a898cc', gf: '#cabfe2', l: '#ffffff', gl: '#ddd3ec', sea: '#ded6e8', w1: '#e0358a', w2: '#1fa3a8', w3: '#e89a1c', h: '#d6247a', k: 1.7 },
  },
}

/** The two lights of a patrol car: the only colors that are not an ink. */
const RED = '#e5484d'
const BLUE = '#3f8cff'

const GLYPHS = '$%tSX:;t$%S'
/** The sky's own letters: light marks high up, heavier ones near the horizon. */
const SKY = ['·', ':', ';', '+', 't', '%', 'S', '$', 'X']

function hash(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const glyphAt = (x: number, y: number) => GLYPHS[Math.floor(hash(x + 7, y + 3) * GLYPHS.length)] ?? '$'

type Tower = readonly [shape: 'deco' | 'slab' | 'hotel', x: number, w: number, h: number]

/** Where things stand, in cells. The wide plan keeps the reading column (the middle) quiet. */
type Plan = {
  cols: number
  rows: number
  horizon: number
  sun: readonly [cx: number, cy: number, r: number]
  palms: readonly (readonly [x: number, base: number, height: number, lean: number])[]
  towers: readonly Tower[]
  far: readonly (readonly [x0: number, x1: number, maxH: number])[]
  clouds: readonly (readonly [cx: number, cy: number, w: number])[]
  ground: readonly (readonly [x0: number, x1: number])[]
  /** The columns the words sit over: glyphs print fainter there. */
  quiet: readonly [x0: number, x1: number]
}

/**
 * The whole window, 1600 × 1000. Art-deco towers and palms stand at the two sides, the
 * slatted sun sits low on the right, and the middle holds only the sky and a far shore.
 */
const WIDE: Plan = {
  cols: 100,
  rows: 63,
  horizon: 54,
  // The sun stands at the right edge, half out of the picture: in a wide window that is
  // the margin beside the reading column, not under it.
  sun: [91, 46, 12.5],
  // Two tall palms frame the picture; one slim palm and one tall one stand in front of the sun, the way a postcard has them.
  palms: [[3, 63, 34, 3], [10, 63, 23, -2], [97, 63, 31, -3], [85, 55, 14, -2], [37, 54, 6, 1]],
  towers: [
    ['slab', 13, 4, 11], ['deco', 18, 7, 23], ['hotel', 25, 5, 8], ['slab', 29, 2, 5],
    ['slab', 70, 3, 8], ['deco', 73, 5, 15], ['hotel', 78, 4, 5],
  ],
  far: [[31, 67, 4]],
  clouds: [[66, 33, 16], [90, 29, 12], [22, 14, 14]],
  ground: [],
  // The reading column is not in the middle of the window: a sidebar pushes it to the
  // right, a pane to the left. So all but the edges is printed quietly.
  quiet: [20, 94],
}

/** A banner, 45 × 10 cells: the same scene with everything pulled in. */
const STRIP: Plan = {
  cols: 45,
  rows: 10,
  horizon: 8,
  sun: [30, 8.6, 6],
  palms: [[4, 10, 7, 1]],
  towers: [['deco', 9, 3, 5], ['hotel', 12, 4, 2], ['slab', 37, 2, 4], ['deco', 39, 4, 6], ['hotel', 43, 2, 2]],
  far: [[16, 23, 1]],
  clouds: [[27, 4, 9]],
  ground: [],
  quiet: [0, 0],
}

/** The busted banner: the left is kept clear for the word, the moon and the city stand on the right. */
const BANNER: Plan = {
  cols: 45,
  rows: 10,
  horizon: 8,
  sun: [39.5, 6.6, 4.4],
  palms: [],
  towers: [['slab', 33, 2, 2], ['deco', 35, 3, 4], ['hotel', 38, 4, 2], ['slab', 42, 3, 3]],
  far: [],
  clouds: [],
  ground: [],
  quiet: [0, 0],
}

export type Scene = {
  plan: Plan
  /** What never moves: the far and near city, the top of the sun, the ground. */
  still: Tile[]
  /** The striped foot of the sun, its gaps one row lower in each pose. */
  sun: Tile[][]
  /** Each palm in two poses: the fronds a cell apart at the tips. */
  palms: Tile[][][]
  clouds: Tile[][]
  /** The sun on the water. */
  glint: Tile[]
  /** Lit windows. */
  lights: Tile[]
}

function sunTiles(plan: Plan): { top: Tile[]; poses: Tile[][] } {
  const [cx, cy, r] = plan.sun
  const top: Tile[] = []
  const poses: Tile[][] = [[], [], []]
  // The foot is slatted like a blind: every third row is a gap, counted up from the horizon, and the gaps walk.
  const y0 = plan.horizon - Math.min(7, Math.round(r * 0.6))
  for (let y = Math.floor(cy - r); y < plan.horizon; y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= plan.cols || y < 0) continue
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue
      const kind = y < cy - r * 0.4 ? 'a' : y < cy + r * 0.15 ? 'b' : 'c'
      if (y < y0) top.push([x, y, kind])
      else for (let p = 0; p < 3; p++) if ((plan.horizon - y + p) % 3 !== 2) poses[p]?.push([x, y, kind])
    }
  }
  return { top, poses }
}

/**
 * One building of the near city. `deco`: a stepped tower with a spire. `slab`: a flat
 * high-rise with a roof block and an antenna. `hotel`: a low wide block with a fin.
 */
function towerTiles(t: Tower, horizon: number): { tiles: Tile[]; lights: Tile[] } {
  const [shape, x, w, h] = t
  const tiles: Tile[] = []
  const lights: Tile[] = []
  const col = (cx: number, from: number, to: number) => {
    for (let dy = from; dy <= to; dy++) tiles.push([cx, horizon - dy, 'i'])
  }
  for (let dx = 0; dx < w; dx++) {
    let top = h
    if (shape === 'deco') {
      // Three tiers: the shoulders step in by a cell on each side.
      const inset = Math.min(dx, w - 1 - dx)
      top = inset === 0 ? Math.max(1, Math.round(h * 0.55)) : inset === 1 ? Math.max(2, Math.round(h * 0.8)) : h
      if (w <= 2) top = h
    }
    col(x + dx, 1, top)
    for (let dy = 2; dy < top; dy++) {
      const p = hash(x + dx + 5, dy + h)
      if (p < 0.13) lights.push([x + dx, horizon - dy, p < 0.05 ? 'w' : p < 0.09 ? 'v' : 'y'])
    }
  }
  const mid = x + Math.floor((w - 1) / 2)
  if (shape === 'deco') col(mid, h + 1, h + (h > 8 ? 3 : 1))
  if (shape === 'slab') {
    if (w >= 3) col(x + 1, h + 1, h + 1)
    col(x + w - 1, h + 1, h + (h > 6 ? 2 : 1))
  }
  if (shape === 'hotel') col(mid, h + 1, h + 2)
  return { tiles, lights }
}

function farTiles(plan: Plan): Tile[] {
  const tiles: Tile[] = []
  for (const [x0, x1, maxH] of plan.far) {
    let x = x0
    while (x < x1) {
      const w = 2 + Math.floor(hash(x, 11) * 3)
      const h = 1 + Math.floor(hash(x + 31, 11) ** 1.5 * maxH)
      for (let dx = 0; dx < w && x + dx < x1; dx++) for (let dy = 1; dy <= h; dy++) tiles.push([x + dx, plan.horizon - dy, 'f'])
      x += w + (hash(x + 3, 11) < 0.3 ? 1 : 0)
    }
  }
  return tiles
}

/**
 * A palm: a leaning trunk and six fronds. Each frond is an arc from the crown that rises
 * and then droops (`rise` cells up per step, `sag` pulling it down). `pose` 1 lets them
 * hang a little more, so the tips move a cell.
 */
function palmTiles(x: number, base: number, height: number, lean: number, pose: number): Tile[] {
  const seen = new Set<string>()
  const out: Tile[] = []
  const put = (px: number, py: number) => {
    const key = `${px},${py}`
    if (seen.has(key)) return
    seen.add(key)
    out.push([px, py, 'i'])
  }
  for (let t = 0; t <= height; t++) put(x + Math.round(lean * (t / height) ** 1.7), base - t)
  const cx = x + lean
  const cy = base - height
  const k = Math.max(0.42, Math.min(1.15, height / 24))
  const fronds: readonly (readonly [number, number, number, number])[] = [
    [-1, 1.45, 0.15, 9],
    [-1, 0.62, 0.115, 9],
    [-1, -0.3, 0.085, 6],
    [1, 1.45, 0.15, 9],
    [1, 0.62, 0.115, 9],
    [1, -0.3, 0.085, 6],
  ]
  put(cx, cy - 1)
  for (const [dir, rise, sag, len] of fronds) {
    const n = Math.max(2, Math.round(len * k))
    for (let s = 1; s <= n; s++) {
      // A short palm bends its arcs sooner, so it keeps the same silhouette.
      const u = s / k
      const py = cy + Math.round((-rise * u + (sag + pose * 0.014) * u * u) * k)
      put(cx + dir * s, py)
      // A tall palm has leaves, not lines: leaflets hang from every other cell of a frond.
      if (height >= 16 && s % 2 === 0 && s < n) put(cx + dir * s, py + 1)
    }
  }
  return out
}

/** A cloud at dusk: two long thin bars, the lower one set off to the side. */
function cloudTiles(cx: number, cy: number, w: number): Tile[] {
  const out: Tile[] = []
  for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) out.push([x, Math.round(cy), 'l'])
  for (let x = Math.round(cx - w * 0.2); x < Math.round(cx + w * 0.62); x++) out.push([x, Math.round(cy) + 1, 'l'])
  return out
}

export function buildScene(plan: Plan): Scene {
  const sun = sunTiles(plan)
  const near: Tile[] = []
  const lights: Tile[] = []
  for (const t of plan.towers) {
    const b = towerTiles(t, plan.horizon)
    near.push(...b.tiles)
    lights.push(...b.lights)
  }
  const ground: Tile[] = []
  for (const [x0, x1] of plan.ground) {
    for (let x = x0; x < x1; x++) {
      const top = plan.horizon + 8 + Math.round(1.4 * hash(x >> 2, 77))
      for (let y = top; y < plan.rows; y++) ground.push([x, y, 'i'])
    }
  }
  const [cx, , r] = plan.sun
  const glint: Tile[] = []
  for (let dy = 1; dy < plan.rows - plan.horizon; dy++) {
    const half = Math.max(1, Math.round(r * 0.75 - dy * 0.9))
    if (dy % 2 === 0 || half < 1) continue
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) if (hash(x, dy) > 0.25) glint.push([x, plan.horizon + dy, 'b'])
  }
  return {
    plan,
    still: [...farTiles(plan), ...sun.top, ...near, ...ground],
    sun: sun.poses,
    palms: plan.palms.map(([x, base, height, lean]) => [palmTiles(x, base, height, lean, 0), palmTiles(x, base, height, lean, 1)]),
    clouds: plan.clouds.map(([x, y, w]) => cloudTiles(x, y, w)),
    glint,
    lights,
  }
}

/** Tiles of one kind in a single path; glyphs in one text per row with a per-glyph x list. */
function mosaic(tiles: readonly Tile[], cell: number, withGlyphs: boolean): string {
  const byKind = new Map<string, Tile[]>()
  for (const t of tiles) {
    const list = byKind.get(t[2]) ?? []
    list.push(t)
    byKind.set(t[2], list)
  }
  let out = ''
  for (const [kind, list] of byKind) {
    // The silhouette is solid, so the city and the palms read as shapes; every other tile keeps its gap.
    const s = kind === 'i' ? cell : cell - 2
    const o = kind === 'i' ? 0 : 1
    if (kind === 'i') {
      // Solid tiles side by side are one bar: the same picture in far fewer characters.
      const sorted = [...list].sort((a, b) => a[1] - b[1] || a[0] - b[0])
      let d = ''
      for (let n = 0; n < sorted.length; ) {
        const [x, y] = sorted[n] as Tile
        let run = 1
        while (sorted[n + run]?.[1] === y && sorted[n + run]?.[0] === x + run) run++
        d += `M${x * cell} ${y * cell}h${run * cell}v${cell}h-${run * cell}z`
        n += run
      }
      out += `<path class="ki" d="${d}"/>`
    } else {
      out += `<path class="k${kind}" d="${list.map(([x, y]) => `M${x * cell + o} ${y * cell + o}h${s}v${s}h-${s}z`).join('')}"/>`
    }
    if (!withGlyphs || !'abcifl'.includes(kind)) continue
    const rows = new Map<number, Tile[]>()
    for (const t of list) {
      const row = rows.get(t[1]) ?? []
      row.push(t)
      rows.set(t[1], row)
    }
    const g = kind === 'a' || kind === 'b' || kind === 'c' ? 'a' : kind
    for (const [y, row] of rows) {
      out += `<text class="g${g}" x="${row.map(([x]) => x * cell + cell / 2).join(' ')}" y="${y * cell + Math.round(cell * 0.72)}">${row.map(([x]) => glyphAt(x, y)).join('')}</text>`
    }
  }
  return out
}

/**
 * The sky as a field of glyphs: sparse and faint high up, dense and bright at the horizon,
 * so the sunset is carried by the letters. It is cut into blocks (5 × 3 cells in the wide
 * scene, smaller in a banner); each block lights up under the pointer and fades back
 * slowly, which leaves a wake behind a moving cursor. A slow wave runs through the blocks
 * by itself, so the sky is alive where no pointer reaches it.
 */
function field(s: Scene, cell: number, BW = 5, BH = 3): string {
  const p = s.plan
  // The field runs under everything, with no holes cut for the city or the sun: a tile
  // hides the glyph of its cell, and a group can then be moved over the sky (a narrow
  // window pulls the two sides in) without leaving its shadow behind.
  let out = ''
  for (let by = 0; by * BH < p.horizon; by++) {
    for (let bx = 0; bx * BW < p.cols; bx++) {
      let rows = ''
      for (let dy = 0; dy < BH; dy++) {
        const y = by * BH + dy
        if (y >= p.horizon) break
        // 0 at the top of the sky, 1 at the horizon.
        const depth = y / Math.max(1, p.horizon - 1)
        let line = ''
        let any = false
        for (let dx = 0; dx < BW; dx++) {
          const x = bx * BW + dx
          const isQuiet = x >= p.quiet[0] && x < p.quiet[1]
          const density = (0.16 + 0.62 * depth ** 1.6) * (isQuiet ? 0.6 : 1)
          if (x >= p.cols || hash(x * 3 + 1, y * 7 + 2) > density) {
            line += ' '
            continue
          }
          const weight = Math.min(SKY.length - 1, Math.floor((depth * 0.75 + hash(x + 13, y + 29) * 0.4) * SKY.length))
          line += SKY[weight] ?? '·'
          any = true
        }
        if (!any) continue
        const band = depth < 0.4 ? 1 : depth < 0.74 ? 2 : 3
        const mid = bx * BW + Math.floor(BW / 2)
        const isQuiet = mid >= p.quiet[0] && mid < p.quiet[1]
        const level = Math.max(1, Math.min(5, Math.round(1 + depth * 4) - (isQuiet ? 1 : 0)))
        rows += `<text class="r${band} o${level}" x="${bx * BW * cell + 4}" y="${y * cell + Math.round(cell * 0.72)}">${line.replace(/\s+$/, '')}</text>`
      }
      if (rows) out += `<g class="b d${bx % 16}">${rows}</g>`
    }
  }
  return `<g class="sky">${out}</g>`
}

const vars = (base: Inks, paper: Paper, isAmbient: boolean) => {
  const k = isAmbient ? { ...base, ...AMBIENT[paper].inks } : base
  const glow = isAmbient ? AMBIENT[paper].glow : GLOW[paper]
  return `--so:${isAmbient ? AMBIENT[paper].so : 1};--o1:${glow[0]};--o2:${glow[1]};--s0:${k.s0};--s1:${k.s1};--g1:${k.g1};--g2:${k.g2};--f1:${k.f1};--f2:${k.f2};--f3:${k.f3};--a:${k.a};--b:${k.b};--c:${k.c};--ga:${k.ga};--i:${k.i};--gi:${k.gi};--f:${k.f};--gf:${k.gf};--l:${k.l};--gl:${k.gl};--sea:${k.sea};--w1:${k.w1};--w2:${k.w2};--w3:${k.w3};--h:${k.h};--k:${k.k}`
}

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

/**
 * The style every picture shares. The inks are custom properties, so with `auto` the
 * same picture prints on dark stock by default and on light paper in a light window.
 * What a rest picture needs stands in the plain rules: an app can stop a scene by taking
 * every animation away, and the picture must still be composed.
 */
function styleOf(tod: TimeOfDay, stock: Stock, cell: number, motion: string, isAmbient = false): string {
  const inks = INKS[tod]
  const base = stock === 'light' ? inks.light : inks.dark
  // A mono glyph is about 0.6 em wide: the spacing brings each one onto its cell.
  const size = Math.round(cell * 0.68)
  return (
    `<style>svg{${vars(base, stock === 'light' ? 'light' : 'dark', isAmbient)}}` +
    (stock === 'auto' ? `@media (prefers-color-scheme:light){svg{${vars(inks.light, 'light', isAmbient)}}}` : '') +
    `text{font:800 ${cell - 5}px ${MONO};text-anchor:middle}` +
    `.ka{fill:var(--a)}.kb{fill:var(--b)}.kc{fill:var(--c)}.ki{fill:var(--i)}.kf{fill:var(--f)}.kl{fill:var(--l)}.kw{fill:var(--w1)}.kv{fill:var(--w2)}.ky{fill:var(--w3)}.kh{fill:var(--gl)}.kr{fill:${RED}}.ku{fill:${BLUE}}.kx{fill:#fff1f8}` +
    `.ga{fill:var(--ga)}.gi{fill:var(--gi)}.gf{fill:var(--gf)}.gl{fill:var(--gl)}` +
    `.sky text{font:600 ${size}px ${MONO};text-anchor:start;white-space:pre;letter-spacing:${(cell - size * 0.6).toFixed(2)}px;transition:fill 1.8s ease-out,fill-opacity 1.8s ease-out}` +
    `.r1{fill:var(--f1)}.r2{fill:var(--f2)}.r3{fill:var(--f3)}` +
    [0.13, 0.2, 0.3, 0.44, 0.6].map((o, n) => `.o${n + 1}{fill-opacity:calc(${o}*var(--k))}`).join('') +
    // Under the pointer a block turns bright at once and lets go slowly. `.on` is the same
    // state set from outside, for a mock-up or a film.
    `.b{pointer-events:bounding-box}.b:hover text,.b.on text{fill:var(--h);fill-opacity:1;transition:none}` +
    `.S{opacity:var(--so)}.p2,.p3,.q2{opacity:0}` +
    motion +
    `@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`
  )
}

/**
 * Slow and stepped, transform and opacity only. Poses take turns (the sun's blind, the
 * palms, a rotor); whole groups move a cell at a time; a wave of light walks through the sky.
 * Nothing eases: every animation is `steps()`, so the picture is painted again a few times
 * a second at most, not sixty, and a window with the scene behind it stays cool.
 */
const MOTION =
  `@keyframes pose3{0%{opacity:1}33.33%,100%{opacity:0}}` +
  `@keyframes pose2{0%{opacity:1}50%,100%{opacity:0}}` +
  `@keyframes tw{from{opacity:.25}to{opacity:1}}` +
  `@keyframes wave{0%,100%{opacity:.55}50%{opacity:1}}` +
  `@keyframes fly{from{transform:translateX(-320px)}to{transform:translateX(1760px)}}` +
  `@keyframes hover{from{transform:translate(0,-16px)}to{transform:translate(48px,16px)}}` +
  `@keyframes sweep{from{transform:rotate(-13deg)}to{transform:rotate(15deg)}}` +
  `@keyframes tide{from{transform:translateX(-32px)}to{transform:translateX(0)}}` +
  `@keyframes cop{50%{opacity:.15}}` +
  `@keyframes sail{from{transform:translateX(-96px)}to{transform:translateX(1680px)}}` +
  `@keyframes run{from{transform:translateX(-64px)}to{transform:translateX(1632px)}}` +
  `.p1,.p2,.p3{animation:pose3 12s steps(1) infinite}.p2{animation-delay:4s}.p3{animation-delay:8s}` +
  `.q1,.q2{animation:pose2 7s steps(1) infinite}.q2{animation-delay:3.5s}` +
  `.rotor .q1,.rotor .q2{animation-duration:.8s}.rotor .q2{animation-delay:.4s}` +
  `.wing .q1,.wing .q2{animation-duration:2.2s}.wing .q2{animation-delay:1.1s}` +
  // The wave: a block steps every two seconds, and its neighbour a second later, so all
  // of the sky's steps fall on one beat a second.
  `.b{animation:wave 16s steps(4) infinite}` +
  Array.from({ length: 16 }, (_, n) => `.d${n}{animation-delay:${-n}s}`).join('') +
  `.glint{animation:tw 5s steps(3) infinite alternate}` +
  `.lit{animation:tw 9s steps(2) infinite alternate}.lit2{animation:tw 6s steps(2) -3s infinite alternate}` +
  `.st1,.st2,.st3{animation:tw 8s steps(3) infinite alternate}.st2{animation-delay:-3s}.st3{animation-delay:-5s}` +
  // A cell at a time: the flock, the boat and the car on the shore move the way tiles do.
  `.birds{animation:fly 110s steps(130) infinite}` +
  // At rest (reduced motion) each stands at a place of its own, not at the left edge.
  `.boat{transform:translateX(560px);animation:sail 300s steps(111) infinite}` +
  `.run{transform:translateX(1040px);animation:run 36s steps(106) infinite}` +
  `.heli{animation:hover 9s steps(6) infinite alternate}` +
  `.beam{animation:sweep 8s steps(10) infinite alternate}` +
  `.tide{animation:tide 16s steps(8) infinite}.tide2{animation:tide 24s steps(8) infinite reverse}` +
  `.cr{animation:cop .9s steps(1) 14}.cu{animation:cop .9s steps(1) .45s 14}`

/**
 * A narrow window shows the middle of the picture, where little stands. So the two
 * sides step in as the box gets narrower, and on a phone held upright the sun and its
 * palms take the middle. The rule reads the scene's own box, not the device.
 */
const SIDES =
  `@media (max-aspect-ratio:13/10){.L{transform:translateX(144px)}.R{transform:translateX(-144px)}}` +
  `@media (max-aspect-ratio:1/1){.L{transform:translateX(288px)}.R{transform:translateX(-288px)}}` +
  `@media (max-aspect-ratio:3/4){.L{transform:translateX(400px)}.R{transform:translateX(-416px)}}` +
  `@media (max-aspect-ratio:9/16){.L{opacity:0}.R{transform:translateX(-496px)}}` +
  // Narrow, the words always lie over the sun: it steps back further.
  `@media (max-aspect-ratio:1/1){.S{opacity:calc(var(--so)*.7)}}`

/** A cloud drifts four pixels at a step, there and back. */
const drift = (i: number, cell: number) => {
  const span = cell * (7 + i * 3)
  return `@keyframes drift${i}{from{transform:translateX(${-cell * (3 + i)}px)}to{transform:translateX(${cell * (4 + i * 2)}px)}}.c${i}{animation:drift${i} ${150 + i * 45}s steps(${Math.max(8, Math.round(span / 4))}) infinite alternate}`
}

function starsPath(plan: Plan, cell: number): string {
  let out = ''
  for (let g = 0; g < 3; g++) {
    let d = ''
    for (let n = 0; n < 26; n++) {
      const x = Math.floor(hash(n, 100 + g) * plan.cols * cell)
      const y = Math.floor(hash(n, 200 + g) * (plan.horizon - 6) * cell)
      d += `M${x} ${y}h3v3h-3z`
    }
    out += `<path class="ky st${g + 1}" d="${d}"/>`
  }
  return out
}

/** A flock of four, each a small V in two wing poses. */
function birds(cell: number, x: number, y: number): string {
  const at: readonly (readonly [number, number])[] = [[0, 0], [5, 2], [9, -1], [14, 3]]
  const up: Tile[] = []
  const down: Tile[] = []
  for (const [dx, dy] of at) {
    up.push([x + dx, y + dy, 'i'], [x + dx + 1, y + dy + 1, 'i'], [x + dx + 2, y + dy, 'i'])
    down.push([x + dx, y + dy + 1, 'i'], [x + dx + 1, y + dy + 1, 'i'], [x + dx + 2, y + dy + 1, 'i'])
  }
  return `<g class="birds"><g class="wing"><g class="q1">${mosaic(up, cell, false)}</g><g class="q2">${mosaic(down, cell, false)}</g></g></g>`
}

/** A helicopter with its searchlight: what four stars and more bring over the city. */
function helicopter(cell: number, x: number, y: number, beam: number): string {
  // Nose to the left: a cabin with one lit window, a tail boom with its fin, two skids.
  const body: Tile[] = [
    [x + 2, y + 1, 'h'],
    [x + 1, y + 2, 'y'], [x + 2, y + 2, 'h'], [x + 3, y + 2, 'h'], [x + 4, y + 2, 'h'], [x + 5, y + 2, 'h'], [x + 6, y + 2, 'h'], [x + 7, y + 2, 'h'],
    [x + 7, y + 1, 'h'],
    [x, y + 3, 'h'], [x + 1, y + 3, 'h'], [x + 2, y + 3, 'h'], [x + 3, y + 3, 'h'], [x + 4, y + 3, 'h'],
    [x + 1, y + 4, 'l'], [x + 4, y + 4, 'l'],
  ]
  const wide: Tile[] = [-1, 0, 1, 2, 3, 4, 5].map(dx => [x + dx, y, 'h'] as const)
  const narrow: Tile[] = [1, 2, 3].map(dx => [x + dx, y, 'h'] as const)
  const ox = (x + 1) * cell
  const oy = (y + 4) * cell
  return (
    `<g class="heli">` +
    `<g class="beam" style="transform-origin:${ox}px ${oy}px"><path d="M${ox} ${oy}L${ox - beam * 0.42} ${oy + beam}L${ox + beam * 0.12} ${oy + beam}Z" fill="url(#beam)"/></g>` +
    mosaic(body, cell, false) +
    `<g class="rotor"><g class="q1">${mosaic(wide, cell, false)}</g><g class="q2">${mosaic(narrow, cell, false)}</g></g>` +
    `</g>`
  )
}

/** Patrol lights at the foot of the city: they blink while the level is new, then one of each stays lit. */
function patrol(cell: number, spots: readonly (readonly [number, number])[], flash: boolean): string {
  let out = ''
  for (const [x, y] of spots) {
    out += `<g${flash ? ' class="cr"' : ''}>${mosaic([[x, y, 'r']], cell, false)}</g><g${flash ? ' class="cu"' : ''}>${mosaic([[x + 1, y, 'u']], cell, false)}</g>`
  }
  return out
}

type LayerOptions = { tod: TimeOfDay; heat: number; flash: boolean; isWide: boolean; withField: boolean; block?: readonly [number, number] }

/** The wide scene's left third, right two fifths and middle: a narrow window pulls the sides in. */
const sideOf = (x: number, cols: number) => (x < cols * 0.33 ? 'L' : x > cols * 0.6 ? 'R' : 'M')

/** A group that belongs to one side. */
const side = (name: string, body: string) => (name === 'M' || !body ? body : `<g class="${name}">${body}</g>`)

/** Tiles drawn per side in the wide scene, as one mosaic anywhere else. */
function sided(tiles: readonly Tile[], cell: number, withGlyphs: boolean, cols: number, isWide: boolean): string {
  if (!isWide) return mosaic(tiles, cell, withGlyphs)
  let out = ''
  for (const name of ['L', 'M', 'R']) {
    const part = tiles.filter(t => sideOf(t[0], cols) === name)
    if (part.length) out += side(name, mosaic(part, cell, withGlyphs))
  }
  return out
}

/** A small boat on the water: a hull, a sail, one lit porthole. It crosses in five minutes. */
function boat(cell: number, y: number): string {
  const tiles: Tile[] = [[0, y, 'f'], [1, y, 'y'], [2, y, 'f'], [3, y, 'f'], [1, y - 1, 'l'], [2, y - 1, 'l'], [2, y - 2, 'l']]
  return `<g class="boat">${mosaic(tiles, cell, false)}</g>`
}

function layers(s: Scene, cell: number, o: LayerOptions): string {
  const p = s.plan
  const w = p.cols * cell
  const h = p.rows * cell
  const sea = p.horizon * cell
  const isLit = o.tod === 'night' || o.tod === 'sunset'
  const hot = o.heat >= 3
  const glowTop = Math.round(sea * (o.isWide ? 0.22 : 0.1))
  const half = Math.ceil(s.lights.length / 2)
  const tiles = (list: readonly Tile[], withGlyphs: boolean) => sided(list, cell, withGlyphs, p.cols, o.isWide)
  const sunSide = o.isWide ? sideOf(p.sun[0], p.cols) : 'M'
  return (
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--s0)"/><stop offset="1" style="stop-color:var(--s1)"/></linearGradient>` +
    // The glow that rises from the horizon: the one gradient the scene has, and it belongs to the paper.
    `<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--g1);stop-opacity:0"/><stop offset=".55" style="stop-color:var(--g1);stop-opacity:var(--o1)"/><stop offset="1" style="stop-color:var(--g2);stop-opacity:var(--o2)"/></linearGradient>` +
    (o.isWide
      ? // Fainter behind the words: the middle of the window keeps a third of the light.
        `<linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset=".08" stop-color="#fff"/><stop offset=".26" stop-color="#5a5a5a"/><stop offset=".82" stop-color="#5a5a5a"/><stop offset=".97" stop-color="#fff"/></linearGradient>` +
        `<mask id="quiet" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="url(#side)"/></mask>`
      : '') +
    `<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".36"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>` +
    `<pattern id="dash" width="${cell * 2}" height="${cell}" patternUnits="userSpaceOnUse"><rect x="${cell * 0.3}" y="${cell * 0.44}" width="${cell * 0.5}" height="2" rx="1" style="fill:var(--f3)"/></pattern>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>` +
    `<rect y="${glowTop}" width="${w}" height="${sea - glowTop}" fill="url(#glow)"${o.isWide ? ' mask="url(#quiet)"' : ''}/>` +
    (o.tod === 'night' ? starsPath(p, cell) : '') +
    (o.withField ? field(s, cell, o.block?.[0], o.block?.[1]) : '') +
    s.clouds.map((c, i) => `<g class="c${i}">${mosaic(c, cell, true)}</g>`).join('') +
    (o.isWide && !hot && o.tod !== 'night' ? birds(cell, 20, 24) : '') +
    // The far shore is one piece: it stays put when the sides step in.
    mosaic(s.still.filter(t => t[2] === 'f'), cell, true) +
    side(sunSide, `<g class="S">${mosaic(s.still.filter(t => t[2] === 'a' || t[2] === 'b' || t[2] === 'c'), cell, true)}${s.sun.map((pose, i) => `<g class="p${i + 1}">${mosaic(pose, cell, true)}</g>`).join('')}</g>`) +
    // The water: a flat tone, two rows of dashes sliding past each other, the sun broken on it.
    `<rect y="${sea}" width="${w}" height="${h - sea}" style="fill:var(--sea)"/>` +
    `<g class="tide"><rect x="${-cell * 2}" y="${sea}" width="${w + cell * 4}" height="${h - sea}" fill="url(#dash)" opacity=".34"/></g>` +
    // The offset sits on an outer group: an animated transform would replace it.
    `<g transform="translate(${cell} ${cell / 2})"><g class="tide2"><rect x="${-cell * 2}" y="${sea}" width="${w + cell * 4}" height="${h - sea}" fill="url(#dash)" opacity=".2"/></g></g>` +
    side(sunSide, `<g class="S"><g class="glint">${mosaic(s.glint, cell, false)}</g></g>`) +
    (o.isWide ? boat(cell, p.horizon + 1) : '') +
    tiles(s.still.filter(t => t[2] === 'i'), true) +
    // Windows come on at dusk, in two groups that take turns.
    (isLit ? `<g class="lit">${tiles(s.lights.slice(0, half), false)}</g><g class="lit2">${tiles(s.lights.slice(half), false)}</g>` : '') +
    s.palms
      .map(([a, b], i) => side(o.isWide ? sideOf(p.palms[i]?.[0] ?? 0, p.cols) : 'M', `<g class="q1">${mosaic(a ?? [], cell, true)}</g><g class="q2">${mosaic(b ?? [], cell, true)}</g>`))
      .join('') +
    (hot
      ? (o.isWide ? ([[14, p.horizon - 1], [92, p.horizon - 1], [44, p.horizon - 1]] as const) : ([[36, p.horizon - 1]] as const))
          .map(spot => side(o.isWide ? sideOf(spot[0], p.cols) : 'M', patrol(cell, [spot], o.flash)))
          .join('')
      : '') +
    // Four stars: a car runs the length of the shore, a helicopter hangs over the city.
    (o.isWide && o.heat >= 4 ? `<g class="run">${mosaic([[0, p.horizon, 'r'], [1, p.horizon, 'u']], cell, false)}</g>` : '') +
    (o.heat >= 4 ? helicopter(cell, o.isWide ? 50 : 25, o.isWide ? 16 : 1, (o.isWide ? 30 : 6) * cell) : '') +
    (o.isWide && o.heat >= 5 ? side('L', helicopter(cell, 28, 28, 22 * cell)) : '')
  )
}

const WIDE_SCENE = buildScene(WIDE)
const STRIP_SCENE = buildScene(STRIP)
const BANNER_SCENE = buildScene(BANNER)

/**
 * The backdrop for the whole window: 1600 × 1000, cropped to fill. `heat` is the wanted
 * level (patrol lights from three stars, a helicopter from four), `flash` says the level is new.
 */
export function backdropSvg(tod: TimeOfDay, stock: Stock, heat = 0, flash = false): string {
  const motion = MOTION + SIDES + WIDE_SCENE.clouds.map((_, i) => drift(i, CELL)).join('')
  // Cropped to fill, and held by its foot: the shore stays in the window whatever its shape.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMax slice">` +
    styleOf(tod, stock, CELL, motion, true) +
    layers(WIDE_SCENE, CELL, { tod, heat, flash, isWide: true, withField: true }) +
    `</svg>`
  )
}

/** The banner of the welcome card and of the stats pane: 720 × 160 with rounded corners. */
export function stripSvg(tod: TimeOfDay, stock: Stock, id = 'vs', heat = 0): string {
  const motion = MOTION + STRIP_SCENE.clouds.map((_, i) => drift(i, CELL / 2)).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="160" viewBox="0 0 720 160">` +
    styleOf(tod, stock, CELL, motion) +
    `<defs><clipPath id="${id}"><rect width="720" height="160" rx="12"/></clipPath></defs>` +
    // Small blocks: in a banner the pointer draws a fine line through the sky.
    `<g clip-path="url(#${id})">${layers(STRIP_SCENE, CELL, { tod, heat, flash: false, isWide: false, withField: true, block: [3, 2] })}</g>` +
    `</svg>`
  )
}

/** A 5 × 7 face for the one word a picture holds. */
const FACE: Record<string, readonly string[]> = {
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  П: ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#...#'],
  О: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  В: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  Я: ['.####', '#...#', '#...#', '.####', '..#.#', '.#..#', '#...#'],
  З: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  А: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  Л: ['..###', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '#...#'],
  И: ['#...#', '#...#', '#..##', '#.#.#', '##..#', '#...#', '#...#'],
}

/** A word set in tiles, one list per letter, or nothing when a letter is missing from the face. */
function wordTiles(word: string, x: number, y: number): Tile[][] | null {
  const out: Tile[][] = []
  let col = x
  for (const ch of word) {
    const rows = FACE[ch]
    if (!rows) return null
    const letter: Tile[] = []
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) if (row[dx] === '#') letter.push([col + dx, y + dy, 'x'])
    })
    out.push(letter)
    col += 6
  }
  return out
}

/**
 * The busted banner, 720 × 150: the night scene, a helicopter with its light, a bar of
 * patrol lights and the word set in tiles, its letters landing one after another. The one
 * loud picture the mod has.
 */
export function bustedSvg(title: string, repo: string, flash: boolean, id = 'vx'): string {
  const cell = 9
  const word = wordTiles(title, 3, 5)
  const bar = Array.from({ length: 80 }, (_, x) => [x, 0, x < 40 ? 'r' : 'u'] as const)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Each letter drops in a beat after the one before; at rest they all stand.
  const land = `@keyframes land{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}.w{animation:land .32s steps(3) both}` + Array.from({ length: 10 }, (_, n) => `.w${n}{animation-delay:${(0.15 + n * 0.09).toFixed(2)}s}`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="150" viewBox="0 0 720 150">` +
    styleOf('night', 'dark', CELL, MOTION + land + `.lr{animation:cop .8s steps(1) 16}.lb{animation:cop .8s steps(1) .4s 16}`) +
    `<defs><clipPath id="${id}"><rect width="720" height="150" rx="12"/></clipPath></defs>` +
    `<g clip-path="url(#${id})">` +
    layers(BANNER_SCENE, CELL, { tod: 'night', heat: 4, flash, isWide: false, withField: true }) +
    `<g${flash ? ' class="lr"' : ''}>${mosaic(bar.filter(t => t[2] === 'r'), cell, false)}</g>` +
    `<g${flash ? ' class="lb"' : ''}>${mosaic(bar.filter(t => t[2] === 'u'), cell, false)}</g>` +
    (word
      ? word.map((letter, n) => `<g class="w w${Math.min(9, n)}">${mosaic(letter, cell, false)}</g>`).join('')
      : `<text x="30" y="96" style="font:800 56px ui-sans-serif,system-ui,sans-serif;text-anchor:start;fill:#fff1f8">${esc(title)}</text>`) +
    (repo ? `<text x="30" y="134" style="font:500 12px ${MONO};text-anchor:start;fill:#fff1f8;fill-opacity:.72">${esc(repo)}</text>` : '') +
    `</g></svg>`
  )
}

/**
 * A still picture with every color written into its shapes: no style element, no classes
 * and no motion, which is what a plugin directory asks of an icon. Only the first pose
 * of each moving part stays.
 */
function flatten(svg: string, k: Inks, cell: number): string {
  const paint: Record<string, string> = { a: k.a, b: k.b, c: k.c, i: k.i, f: k.f, l: k.l, h: k.gl, w: k.w1, v: k.w2, y: k.w3, r: RED, u: BLUE, x: '#fff1f8' }
  const glyph: Record<string, string> = { a: k.ga, i: k.gi, f: k.gf, l: k.gl }
  const ink: Record<string, string> = { s0: k.s0, s1: k.s1, g1: k.g1, g2: k.g2, f: k.f, f3: k.f3, sea: k.sea, h: k.h }
  return svg
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<g class="(?:p2|p3|q2)">[\s\S]*?<\/g>/g, '')
    .replace(/ class="k(\w)"/g, (_, c: string) => ` fill="${paint[c] ?? k.i}"`)
    .replace(/ class="g(\w)"/g, (_, c: string) => ` fill="${glyph[c] ?? k.gi}" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="800" font-size="${cell - 5}" text-anchor="middle"`)
    // The glow's stops carry a strength too; an icon has no variables, so both are written out.
    .replace(/ style="stop-color:var\(--(\w+)\);stop-opacity:([^"]+)"/g, (_, v: string, o: string) => ` stop-color="${ink[v] ?? k.s0}" stop-opacity="${o === 'var(--o1)' ? GLOW.dark[0] : o === 'var(--o2)' ? GLOW.dark[1] : o}"`)
    .replace(/ style="stop-color:var\(--(\w+)\)"/g, (_, v: string) => ` stop-color="${ink[v] ?? k.s0}"`)
    .replace(/ style="(stroke|fill):var\(--(\w+)\)"/g, (_, prop: string, v: string) => ` ${prop}="${ink[v] ?? k.f}"`)
    .replace(/ class="[\w ]+"/g, '')
}

/** The icon, 1024 × 1024: the slatted sun over the water between a tower and a palm, on dark stock. */
export function iconSvg(): string {
  const plan: Plan = { cols: 16, rows: 16, horizon: 12, sun: [7.5, 11.4, 5.6], palms: [], towers: [['deco', 12, 3, 7]], far: [], clouds: [[5, 3, 7]], ground: [], quiet: [0, 0] }
  const cell = 64
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    styleOf('sunset', 'dark', cell, '') +
    layers(buildScene(plan), cell, { tod: 'sunset', heat: 0, flash: false, isWide: false, withField: false }) +
    `</svg>`
  return flatten(svg, INKS.sunset.dark, cell)
}

const hex = (c: string) => parseInt(c.slice(1), 16)

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t))
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

/**
 * The same scene as pixels for the terminal, `width` × `height` (height = 2 × rows): a
 * tile is a pixel there, and the glyphs of the sky are a scatter of lit pixels. Printed on
 * dark stock: a terminal picture brings its own ground.
 */
export function scenePixels(tod: TimeOfDay, width: number, height: number): number[][] {
  const k = INKS[tod].dark
  const horizon = Math.round(height * 0.78)
  const r = Math.min(height * 0.42, width * 0.17)
  const tall = Math.max(3, Math.round(height * 0.5))
  const plan: Plan = {
    cols: width,
    rows: height,
    horizon,
    sun: [width * 0.66, horizon - r * 0.22, r],
    palms: width >= 30 ? [[Math.round(width * 0.08), height, Math.round(height * 0.72), 1]] : [],
    towers: [
      ['deco', Math.round(width * 0.2), 3, tall],
      ['hotel', Math.round(width * 0.2) + 3, 4, Math.max(2, Math.round(tall * 0.35))],
      ['slab', Math.round(width * 0.2) + 8, 2, Math.max(2, Math.round(tall * 0.6))],
      ['slab', width - 9, 2, Math.max(2, Math.round(tall * 0.55))],
      ['deco', width - 6, 4, Math.max(3, Math.round(tall * 0.85))],
    ],
    far: [[Math.round(width * 0.42), Math.round(width * 0.5), 1]],
    clouds: [[width * 0.62, Math.max(1, horizon - r * 0.9), Math.max(4, width * 0.2)]],
    ground: [],
    quiet: [0, 0],
  }
  const s = buildScene(plan)
  const s0 = hex(k.s0)
  const s1 = hex(k.s1)
  const px: number[][] = []
  for (let y = 0; y < height; y++) {
    const depth = y / Math.max(1, horizon - 1)
    // The paper, then the glow rising over the lower half of the sky.
    const glow = Math.max(0, (depth - 0.45) / 0.55)
    const sky = y < horizon ? mix(mix(s0, s1, depth), mix(hex(k.g1), hex(k.g2), glow), glow * 0.55) : hex(k.sea)
    px.push(
      Array.from({ length: width }, (_, x) => {
        if (y >= horizon || hash(x * 3 + 1, y * 7 + 2) > 0.1 + 0.3 * depth) return sky
        return mix(sky, hex(depth < 0.4 ? k.f1 : depth < 0.74 ? k.f2 : k.f3), 0.22 + 0.3 * depth)
      }),
    )
  }
  const paint: Record<string, number> = { a: hex(k.a), b: hex(k.b), c: hex(k.c), i: hex(k.i), f: hex(k.f), l: hex(k.l), w: hex(k.w1), v: hex(k.w2), y: hex(k.w3) }
  const put = (tiles: readonly Tile[], alt?: number) => {
    for (const [x, y, kind] of tiles) {
      const row = px[y]
      if (row && x >= 0 && x < width) row[x] = alt ?? paint[kind] ?? row[x] ?? 0
    }
  }
  s.clouds.forEach(c => put(c))
  put(s.still.filter(t => t[2] !== 'i'))
  put(s.sun[0] ?? [])
  put(s.glint, mix(hex(k.b), hex(k.sea), 0.35))
  put(s.still.filter(t => t[2] === 'i'))
  if (tod === 'night' || tod === 'sunset') put(s.lights)
  s.palms.forEach(([a]) => put(a ?? []))
  return px
}

/** The stock under each kind of window at dusk: the page color the app's own palette is built on. */
export const PAGE: Record<Paper, string> = { dark: INKS.sunset.dark.s0, light: INKS.sunset.light.s0 }
