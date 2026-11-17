// Usage limits as a wanted system. The five-hour window is the wanted level (stars),
// the weekly window (or a spend limit) is armor, a used-up window means busted.
// Pure functions: register.tsx feeds them readings and acts on what they return.

import type { BustKind, Lang, LimitWindow, WantedMemory } from '../../types'
import { fmtClock } from './format'
import { localParts } from './time'

export type LimitReading = { kind: string; percentUsed: number; resetsAt?: string }

/** One window as the mod keeps it: clamped percent and reset time in epoch ms. */
export type Window = LimitWindow

export type Limits = {
  short: Window | null
  week: Window | null
  spend: Window | null
}

/** Lower bound of each star level, in percent of the five-hour window. */
export const STAR_FLOORS = [40, 60, 75, 88, 97] as const

export function clampPct(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0
}

export function starsFor(pct: number | null): number {
  if (pct === null) return 0
  let stars = 0
  for (const floor of STAR_FLOORS) if (pct >= floor) stars += 1
  return stars
}

function toWindow(r: LimitReading | undefined): Window | null {
  if (!r) return null
  const t = r.resetsAt ? Date.parse(r.resetsAt) : NaN
  return { pct: clampPct(r.percentUsed), resetsAt: Number.isFinite(t) ? t : null }
}

/**
 * The windows the engine reported. It drops a window once its reset time passes, so a
 * window missing from a non-empty list, or from an empty list after we had data, is clean.
 */
export function readLimits(readings: readonly LimitReading[]): Limits {
  return {
    short: toWindow(readings.find(r => r.kind === 'five_hour')),
    week: toWindow(readings.find(r => r.kind === 'seven_day')),
    spend: toWindow(readings.find(r => r.kind === 'spend_limit')),
  }
}

/** Armor: what is left of the weekly window, or of the spend limit. */
export function armorOf(l: Limits): Window | null {
  return l.week ?? l.spend
}

/**
 * For a request rejected for its limit: the visible window that explains it (97% or more),
 * or 'hidden' when none does (a model's own weekly cap, overage), which only an answer ends.
 */
export function rejectedBy(l: Limits): { kind: BustKind; until: number | null } {
  const ws: [BustKind, Window | null][] = [['short', l.short], ['week', l.week], ['spend', l.spend]]
  let best: [BustKind, Window] | null = null
  for (const [kind, w] of ws) if (w && w.pct >= 97 && (!best || w.pct > best[1].pct)) best = [kind, w]
  return best ? { kind: best[0], until: best[1].resetsAt } : { kind: 'hidden', until: null }
}

/** Keys of the windows at 100% or more, as remembered in `free`. */
export function fullKeys(l: Limits): string[] {
  const out: string[] = []
  if (l.short && l.short.pct >= 100) out.push(`s${windowKey(l.short)}`)
  if (l.week && l.week.pct >= 100) out.push(`w${windowKey(l.week)}`)
  if (l.spend && l.spend.pct >= 100) out.push(`p${windowKey(l.spend)}`)
  return out
}

/**
 * The window that ran out, if any: the one that put you in cuffs. A window in `free`
 * kept answering past 100% (extra usage), so it does not count.
 */
export function bustedWindow(l: Limits, free: readonly string[] = []): { kind: 'short' | 'week' | 'spend'; w: Window } | null {
  if (l.short && l.short.pct >= 100 && !free.includes(`s${windowKey(l.short)}`)) return { kind: 'short', w: l.short }
  if (l.week && l.week.pct >= 100 && !free.includes(`w${windowKey(l.week)}`)) return { kind: 'week', w: l.week }
  if (l.spend && l.spend.pct >= 100 && !free.includes(`p${windowKey(l.spend)}`)) return { kind: 'spend', w: l.spend }
  return null
}

/** A stable id for one five-hour window, so each star level is announced once per window. */
export function windowKey(w: Window | null): string {
  return w?.resetsAt ? String(Math.round(w.resetsAt / 60_000)) : 'none'
}

/** Time left, never ambiguous with a clock: "1 ч 23 мин" / "1h 23m", "12 мин", "2 дн 4 ч" / "2d 4h". */
export function fmtLeft(ms: number, lang: Lang): string {
  const NB = '\u00a0'
  const totalMin = Math.max(0, Math.ceil(ms / 60_000))
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (lang === 'ru') {
    if (d > 0) return `${d}${NB}дн${h ? ` ${h}${NB}ч` : ''}`
    if (h > 0) return `${h}${NB}ч${m ? ` ${m}${NB}мин` : ''}`
    return `${m}${NB}мин`
  }
  if (d > 0) return `${d}d${h ? ` ${h}h` : ''}`
  if (h > 0) return `${h}h${m ? ` ${m}m` : ''}`
  return `${m}m`
}

const WEEKDAYS: Record<Lang, string[]> = {
  ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

/** When a window resets, in local time: "в 15:40", "завтра в 09:00", "в пт 10:00". */
export function fmtResetAt(resetsAt: number, nowMs: number, offsetMin: number, lang: Lang): string {
  const at = localParts(resetsAt, offsetMin)
  const now = localParts(nowMs, offsetMin)
  const clock = fmtClock(at.hours, at.minutes)
  const dayDiff = Math.round(
    (Date.UTC(at.year, at.month - 1, at.day) - Date.UTC(now.year, now.month - 1, now.day)) / 86_400_000,
  )
  if (dayDiff <= 0) return lang === 'ru' ? `в ${clock}` : `at ${clock}`
  if (dayDiff === 1) return lang === 'ru' ? `завтра в ${clock}` : `tomorrow at ${clock}`
  const wd = WEEKDAYS[lang][at.weekday] ?? ''
  return lang === 'ru' ? `${wd === 'вт' ? 'во' : 'в'} ${wd} ${clock}` : `${wd} at ${clock}`
}

export function emptyMemory(): WantedMemory {
  return { announced: {}, armorAnnounced: {}, peak: 0, peakKey: 'none', busted: null, tipKey: '', healthWarned: false, free: [] }
}

const rank = (k: string | undefined) => (k === undefined || k === 'none' || k === '' ? -1 : Number(k))

/** The four newest ended windows, without repeats: enough to outlast any stale copy. */
function lastClosed(keys: readonly string[]): string[] {
  return [...new Set(keys.filter(k => typeof k === 'string' && k !== 'none'))].sort((a, b) => rank(a) - rank(b)).slice(-4)
}

/** The newer of two window keys (minutes since epoch, or 'none'). */
function newerKey(a: string | undefined, b: string | undefined): string {
  return rank(b) > rank(a) ? (b ?? 'none') : (a ?? 'none')
}

/**
 * Folds in what was stored in $.store by another open session, or by this one before
 * /clear: a level or armor warning said there is not said again here. A stored bust is
 * taken only when asked (at session start): later, each session ends its own bust.
 */
export function mergeMemory(local: WantedMemory, stored: Partial<WantedMemory>, adoptBust: boolean): WantedMemory {
  const s: WantedMemory = { ...emptyMemory(), ...stored }
  const maxOf = (a: Record<string, number>, b: Record<string, number>) => {
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) if (typeof v === 'number') out[k] = Math.max(out[k] ?? 0, v)
    return out
  }
  // A window that ended here or elsewhere cannot come back as the current one,
  // and a session still holding it does not announce a second escape for it.
  const closed = lastClosed([...(local.closed ?? []), ...(Array.isArray(s.closed) ? s.closed : [])])
  const open = (k: string, peak: number): [string, number] => (closed.includes(k) ? ['none', 0] : [k, peak])
  const [lk, lp] = open(local.peakKey, local.peak)
  const [sk, sp] = open(s.peakKey, s.peak)
  const peakKey = newerKey(lk, sk)
  const bust = adoptBust && !local.busted && s.busted ? { busted: s.busted, bustedKey: s.bustedKey } : { busted: local.busted, bustedKey: local.bustedKey }
  return {
    ...local,
    announced: maxOf(local.announced, s.announced ?? {}),
    armorAnnounced: maxOf(local.armorAnnounced, s.armorAnnounced ?? {}),
    peakKey,
    peak: Math.max(lk === peakKey ? lp : 0, sk === peakKey ? sp : 0),
    closed,
    tipKey: newerKey(local.tipKey, s.tipKey),
    free: [...new Set([...(local.free ?? []), ...(s.free ?? [])])],
    ...bust,
    // A bust in a window, here or elsewhere, means waiting it out is no escape.
    bustedKey: bust.busted ? bust.bustedKey : newerKey(local.bustedKey, s.bustedKey),
  }
}

export type WantedEvent =
  | { type: 'stars'; stars: number; pct: number; resetsAt: number | null }
  | { type: 'escape'; peak: number; key: string }
  | { type: 'busted'; kind: BustKind; until: number | null }
  | { type: 'released' }
  | { type: 'armor'; level: 75 | 90; left: number; resetsAt: number | null; kind: 'week' | 'spend' }
  | { type: 'swapRide' }

/**
 * Compares a new reading with what was remembered and says what to announce.
 * A window that ended (a new reset time, or gone from the list) after three stars
 * or more is an escape. `isOpus`: the main model is an Opus, the thirsty ride.
 */
export function diffLimits(
  mem: WantedMemory,
  next: Limits,
  isOpus: boolean,
  nowMs: number,
): { mem: WantedMemory; events: WantedEvent[] } {
  // An extra-usage mark lasts only while that window stays at 100% or more.
  const full = fullKeys(next)
  const m: WantedMemory = {
    ...mem,
    announced: { ...mem.announced },
    armorAnnounced: { ...mem.armorAnnounced },
    free: (mem.free ?? []).filter(k => full.includes(k)),
  }
  const events: WantedEvent[] = []

  // Busted: a window at 100% puts you in cuffs; leaving 100% (or the window ending) frees you.
  // A bust from a rejected request (sticky) can come from a window the mod cannot see, so it
  // lasts until its reset time or until a turn gets an answer again.
  const bust = bustedWindow(next, m.free)
  if (bust && !m.busted) {
    m.busted = { kind: bust.kind, until: bust.w.resetsAt, since: nowMs }
    m.bustedKey = windowKey(next.short)
    events.push({ type: 'busted', kind: bust.kind, until: bust.w.resetsAt })
  } else if (bust && m.busted) {
    m.busted = { ...m.busted, kind: bust.kind, until: bust.w.resetsAt ?? m.busted.until }
  } else if (!bust && m.busted) {
    const isHeld = m.busted.sticky === true && (m.busted.until === null || nowMs < m.busted.until)
    if (!isHeld) {
      m.busted = null
      events.push({ type: 'released' })
    }
  }

  // Stars for the five-hour window, each level once per window.
  const key = windowKey(next.short)
  const stars = starsFor(next.short?.pct ?? null)
  if (key !== m.peakKey) {
    // A new window: if the old one had heat and you were never caught in it, you got away.
    if (m.peak >= 3 && !bust && m.bustedKey !== m.peakKey) events.push({ type: 'escape', peak: m.peak, key: m.peakKey })
    if (m.peakKey !== 'none') m.closed = lastClosed([...(m.closed ?? []), m.peakKey])
    m.peak = 0
    m.peakKey = key
  }
  m.peak = Math.max(m.peak, stars)
  const said = m.announced[key] ?? 0
  if (next.short && stars > said && stars < 6 && !bust) {
    m.announced[key] = stars
    events.push({ type: 'stars', stars, pct: next.short.pct, resetsAt: next.short.resetsAt })
    if (stars >= 3 && isOpus && m.tipKey !== key) {
      m.tipKey = key
      events.push({ type: 'swapRide' })
    }
  }
  // Keep the memory small: only the current window's key matters.
  for (const k of Object.keys(m.announced)) if (k !== key) delete m.announced[k]

  // Armor: the weekly window (or spend limit) at 75% and 90%, once each per window.
  const armor = armorOf(next)
  if (armor) {
    const ak = windowKey(armor)
    const done = m.armorAnnounced[ak] ?? 0
    const level = armor.pct >= 90 ? 90 : armor.pct >= 75 ? 75 : null
    if (level !== null && level > done && armor.pct < 100) {
      m.armorAnnounced[ak] = level
      events.push({ type: 'armor', level, left: 100 - armor.pct, resetsAt: armor.resetsAt, kind: next.week ? 'week' : 'spend' })
    }
    for (const k of Object.keys(m.armorAnnounced)) if (k !== ak) delete m.armorAnnounced[k]
  }
  return { mem: m, events }
}

/** In the last ten minutes of a window the stars blink: you are losing them. */
export function isLosingThem(w: Window | null, nowMs: number): boolean {
  return !!w && w.resetsAt !== null && w.resetsAt - nowMs <= 10 * 60_000 && w.resetsAt > nowMs
}

/**
 * Busts from history: one per rate-limited window ("five_hour:<epoch>"), and for old
 * transcripts without window details one per cluster of rejections 15 minutes apart.
 */
export function countBusts(keys: Iterable<string>): number {
  let windows = 0
  const times: number[] = []
  for (const k of new Set(keys)) {
    if (k.startsWith('t')) {
      const t = Number(k.slice(1))
      if (Number.isFinite(t)) times.push(t)
    } else windows += 1
  }
  times.sort((a, b) => a - b)
  let clusters = 0
  let last = -Infinity
  for (const t of times) {
    if (t - last > 900) clusters += 1
    last = t
  }
  return windows + clusters
}

/** Health from the context: what is left before auto-compact, 0..100. */
export function healthPct(tokens: number | null, threshold: number | null, percent: number | null): number | null {
  if (tokens !== null && threshold !== null && threshold > 0) return clampPct(100 - (tokens / threshold) * 100)
  if (percent !== null) return clampPct(100 - percent)
  return null
}
