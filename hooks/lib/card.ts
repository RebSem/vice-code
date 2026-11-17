// Meters and the turf map for the surfaces that draw SVG (desktop, VS Code, mobile).
// Words and numbers are the surface's own Text, in its fonts and its theme, light or dark;
// the scenes themselves are drawn on a tile grid in tiles.ts.

import type { TimeOfDay } from './time'

/** Generic UI faces for the few words a picture holds; the app's own faces are not reachable from an SVG. */
const SANS = `ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`

/**
 * Tones that read on a light panel and on a dark one alike: an SVG cannot ask which
 * it is drawn on. On the terminal the same meanings are theme keys (TONE_KEY).
 */
export const TONE = { ok: '#3fa05a', warn: '#d69e2e', bad: '#e05268', track: '#8a8780', clay: '#d97757' } as const

export type Tone = 'ok' | 'warn' | 'bad'

/** Theme keys for the terminal, which follows the person's theme. */
export const TONE_KEY = { ok: 'success', warn: 'warning', bad: 'error' } as const

/** Fine above half, a warning under it, bad under a quarter. */
export function toneFor(pct: number | null): Tone {
  if (pct === null || pct > 50) return 'ok'
  if (pct > 25) return 'warn'
  return 'bad'
}

/** Splits text into at most `lines` lines of about `width` characters. */
export function wrap(text: string, width: number, lines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  if (out.length > lines) {
    const kept = out.slice(0, lines)
    kept[lines - 1] = (kept[lines - 1] ?? '').replace(/[\s.,;:!?…]*$/, '') + '…'
    return kept
  }
  return out
}

/** A meter, 72 × 6: what is left, in the tone of how much that is. */
export function meterSvg(pct: number | null): string {
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="6" viewBox="0 0 72 6">` +
    `<rect width="72" height="6" rx="3" fill="${TONE.track}" fill-opacity=".3"/>` +
    (v > 0 ? `<rect width="${Math.max(6, (72 * v) / 100).toFixed(1)}" height="6" rx="3" fill="${TONE[toneFor(pct)]}"/>` : '') +
    `</svg>`
  )
}

function starPath(cx: number, cy: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 3.1 : 7.4
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  }
  return `${d}Z`
}

/**
 * Motion for SVGs drawn with isInteractive (the desktop's sandboxed frame). The lights
 * flash for a few seconds when a level is new and then hold still: a siren that never
 * stops is noise. The person's reduced-motion setting stops it altogether.
 */
const MOTION =
  `<style>` +
  `@keyframes vc-red{50%{fill:#e5484d}}` +
  `@keyframes vc-blue{50%{fill:#3b82f6}}` +
  `@keyframes vc-fade{50%{opacity:.35}}` +
  `@keyframes vc-bar{50%{opacity:.15}}` +
  `.sr{animation:vc-red .9s steps(1) 14}` +
  `.sb{animation:vc-blue .9s steps(1) .45s 14}` +
  `.bl{animation:vc-fade 1.6s ease-in-out infinite}` +
  `.lr{animation:vc-bar .8s steps(1) 16}` +
  `.lb{animation:vc-bar .8s steps(1) .4s 16}` +
  `@media (prefers-reduced-motion:reduce){.sr,.sb,.bl,.lr,.lb{animation:none}}` +
  `</style>`

export type StarsMode = 'still' | 'flash' | 'fade'

/**
 * Five stars, 92 × 16. Lit stars are gold, and red from three up. `flash`: a new level,
 * red and blue take turns for a few seconds; `fade`: the window is about to reset.
 */
export function starsSvg(n: number, mode: StarsMode = 'still'): string {
  const hot = n >= 3
  let out = ''
  for (let i = 0; i < 5; i++) {
    const lit = i < n
    const cls = !lit ? '' : mode === 'fade' ? ' class="bl"' : mode === 'flash' && hot ? ` class="${i % 2 ? 'sb' : 'sr'}"` : ''
    const fill = lit ? (hot ? TONE.bad : TONE.warn) : TONE.track
    out += `<path${cls} d="${starPath(8 + i * 19, 8.4)}" fill="${fill}"${lit ? '' : ' fill-opacity=".35"'}/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="92" height="16" viewBox="0 0 92 16">${MOTION}${out}</svg>`
}

export type BustedData = { title: string; why: string; until: string; pass: string; tod: TimeOfDay; repo: string }

/** Escapes text for SVG content and attribute values. */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** District colors: clay, sky, olive, fig, kraft and heather, the mod's whole palette. */
const DISTRICT_COLORS = ['#d97757', '#6a9bcc', '#8fa36f', '#c46686', '#d4a27f', '#9b93c9']

/** The turf map: projects as districts of an island, sized by sessions. 600 × 340. */
export function mapSvg(
  districts: { name: string; sessions: number; label: string }[],
  current: string | null,
  id = 'vcm',
): string {
  const island =
    'M40 296C52 214 74 150 128 108C184 64 262 48 340 52C430 56 498 86 540 140C576 186 584 244 566 286C556 306 540 312 520 312L60 312C48 312 38 306 40 296Z'
  const x0 = 40
  const x1 = 580
  const total = districts.reduce((s, d) => s + d.sessions, 0) || 1
  let x = x0
  const slices = districts
    .map((d, i) => {
      const w = ((x1 - x0) * d.sessions) / total
      const color = DISTRICT_COLORS[i % DISTRICT_COLORS.length] ?? '#d97757'
      const cx = x + w / 2
      const cy = 210 - (i % 2) * 34
      const rect = `<rect x="${x}" y="40" width="${w}" height="290" fill="${color}" stroke="#141413" stroke-width="2"/>`
      const text =
        w > 46
          ? `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="${w > 120 ? 15 : 12}" fill="#141413">${esc(d.name.slice(0, Math.max(4, Math.floor(w / 9))))}</text>` +
            `<text x="${cx}" y="${cy + 17}" text-anchor="middle" font-family="${SANS}" font-size="11.5" fill="#141413" fill-opacity=".8">${esc(d.label)}</text>`
          : ''
      const arrow =
        current !== null && d.name === current
          ? `<path d="M${cx - 9} ${cy + 44}l9-20l9 20l-9-5Z" fill="#faf9f5" stroke="#141413" stroke-width="2"/>`
          : ''
      x += w
      return rect + text + arrow
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340">` +
    `<defs><clipPath id="${id}-i"><path d="${island}"/></clipPath></defs>` +
    `<rect width="600" height="340" rx="12" fill="#1f2a36"/>` +
    `<g stroke="#3a4a5a" stroke-width="1" opacity=".6"><path d="M0 40H600M0 120H600M0 200H600M0 280H600M100 0V340M250 0V340M400 0V340M550 0V340"/></g>` +
    `<path d="${island}" fill="#30302e"/>` +
    `<g clip-path="url(#${id}-i)">${slices}</g>` +
    `<path d="${island}" fill="none" stroke="#faf9f5" stroke-opacity=".7" stroke-width="2.5"/>` +
    `</svg>`
  )
}
