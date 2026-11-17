// View models: what the loading card, the HUD and the stats pane show, built from
// state values. Pure, so tests and both surfaces share one source of truth.

import type { Env, Hud, Importing, Lang, LimitsState, Live, Radio, Records, Tab, Totals, UiState } from '../../types'
import type { BustedData } from './card'
import { CARS, GREETINGS, NOW_PLAYING, SPINNER, SPINNER_CHASE, STATIONS, TIPS, TOD_LABEL, WEAPON_FALLBACK, WEAPONS } from './content'
import type { SpinnerKind } from './content'
import { clip, fmtClock, fmtCompact, fmtDays, fmtDuration, fmtHours, fmtInt, fmtMoney, fmtSigned } from './format'
import { fmtDate, LABELS } from './i18n'
import { favouriteFamily, laundered, liveDay, modelFamily, ranked, weekNumbers, withLive } from './stats'
import type { Family } from './stats'
import { daysUntilRelease, localParts, timeOfDay } from './time'
import type { TimeOfDay } from './time'
import { armorOf, fmtLeft, fmtResetAt, healthPct, isLosingThem, starsFor } from './wanted'

export const RADIO_STATION = STATIONS[0] ?? { id: 'vicecode', name: 'Neon Coast 104.6', genre: { ru: 'синтвейв', en: 'synthwave' }, url: 'https://open.spotify.com/search/synthwave' }
/** Shown in the loading card's corner, so screenshots lead back to the repository. */
export const REPO_URL = 'github.com/RebSem/vice-code'

/** A small stable hash for picking "random" lines that stay put between redraws. */
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pick<T>(list: readonly T[], n: number): T | undefined {
  return list.length ? list[((n % list.length) + list.length) % list.length] : undefined
}

export function weaponFor(tool: string, lang: Lang): string {
  const w = WEAPONS[tool] ?? WEAPON_FALLBACK
  return w[lang]
}

export function rideFor(family: Family, lang: Lang): string {
  return CARS[family][lang]
}

export function spinnerKind(mode: string): SpinnerKind {
  if (mode === 'thinking') return 'thinking'
  if (mode === 'responding') return 'responding'
  if (mode === 'requesting') return 'requesting'
  return 'tool'
}

/** Four stars and up, the spinner switches to the chase. */
export function spinnerWord(lang: Lang, mode: string, seed: number, stars = 0): string {
  if (stars >= 4) return pick(SPINNER_CHASE[lang], seed) ?? 'Working'
  const kind = spinnerKind(mode)
  return pick(SPINNER[lang][kind], seed + kind.length * 7) ?? 'Working'
}

export function starsText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars))
}

/** The built-in station plays one loop, so the title shown is that loop's. */
export function currentTrack(_radio: Radio): string {
  return NOW_PLAYING[RADIO_STATION.id]?.[0] ?? 'Neon Drive — Palm Avenue'
}

export function tipFor(lang: Lang, day: string, shift: number): string {
  return pick(TIPS[lang], hash(day) + shift) ?? ''
}

export function greetingFor(lang: Lang, tod: TimeOfDay, player: string, sessionId: string): string {
  const line = pick(GREETINGS[lang][tod], hash(sessionId)) ?? '{name}'
  return clip(line.replace('{name}', player || 'player'), 28)
}

export type Snapshot = {
  env: Env
  ui: UiState
  totals: Totals | null
  live: Live | null
  hud: Hud
  importing: Importing
  radio: Radio
  limits: LimitsState
  records: Records
  nowMs: number
}

/** What the wanted screens need: a footer label can draw from this alone. */
export type WantedSnap = Pick<Snapshot, 'env' | 'limits' | 'nowMs'>

/** "в 15:40" / "at 15:40", or null when the window gave no reset time. */
function resetText(s: WantedSnap, at: number | null): string | null {
  return at === null ? null : fmtResetAt(at, s.nowMs, s.env.offset, s.env.lang)
}

/** Everything the screens say about the five-hour window. */
export function wantedView(s: WantedSnap) {
  const L = LABELS[s.env.lang]
  const w = s.limits.short
  const stars = starsFor(w?.pct ?? null)
  const left = w?.resetsAt != null ? fmtLeft(w.resetsAt - s.nowMs, s.env.lang) : null
  return {
    // Stars need the five-hour window; a weekly-only or API-key account has none.
    hasLimits: w !== null,
    stars,
    blink: isLosingThem(w, s.nowMs),
    reset: left ? L.wanted.resetIn(left) : null,
    pct: w?.pct ?? null,
    name: stars > 0 ? L.wanted.levels[stars - 1] ?? '' : L.wanted.clean,
  }
}

/** A short label for the prompt footer: "★★★☆☆ 15:40", "BUSTED 15:40", or null when clean. */
export function wantedLabel(s: WantedSnap): string | null {
  const L = LABELS[s.env.lang]
  const busted = s.limits.mem.busted
  if (busted) {
    const at = busted.until !== null ? fmtResetAt(busted.until, s.nowMs, s.env.offset, s.env.lang) : null
    return at ? `${L.wanted.bustedShort} · ${L.wanted.outAt(at)}` : L.wanted.bustedShort
  }
  const wv = wantedView(s)
  if (!wv.hasLimits || wv.stars === 0) return null
  return `${starsText(wv.stars)}${wv.reset ? ` · ${wv.reset}` : ''}`
}

/** The id of the row a bust places in the conversation: one row per bust. */
export function bustedRowId(b: { since?: number } | null): string {
  return `busted-${b?.since ?? 0}`
}

/** True when the engine's release (`2.1.319`) is older than the one this mod is written for. */
export function isTooOld(base: string | undefined, min: readonly [number, number, number] = [2, 1, 319]): boolean {
  const m = base?.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return false
  for (let i = 0; i < 3; i++) {
    const v = Number(m[i + 1])
    const want = min[i] ?? 0
    if (v !== want) return v < want
  }
  return false
}

/** The busted card, or null when free. */
export function bustedData(s: Snapshot): BustedData | null {
  const b = s.limits.mem.busted
  if (!b) return null
  const L = LABELS[s.env.lang]
  const at = resetText(s, b.until)
  return {
    title: L.wanted.busted,
    why: L.wanted.bustedWhy[b.kind],
    until: at && b.until !== null ? L.wanted.bustedUntil(at, fmtLeft(b.until - s.nowMs, s.env.lang)) : L.wanted.bustedUnknown,
    pass: L.wanted.bustedPass,
    tod: timeOfDay(s.nowMs, s.env.offset),
    repo: REPO_URL,
  }
}

/** What the welcome row says: the greeting, the week in numbers, one line of news and a tip. */
export type CardData = {
  tod: TimeOfDay
  greeting: string
  forLine: string
  tiles: [value: string, label: string][]
  /** One line of news: a bust, a hot wanted level, the import, or the countdown. `strong` is the part to stress. */
  footer: { before: string; strong: string; after: string }
  tipLabel: string
  tip: string
  radio: { isOn: boolean; text: string }
  /** The repository address, shown small so a screenshot leads back to it. */
  repo: string
}

/** What the band above the prompt says. */
export type HudData = {
  tod: TimeOfDay
  healthLabel: string
  armorLabel: string
  health: number | null
  armor: number | null
  /** False when the wanted system is off: the armor is left out. */
  showArmor: boolean
  noLimit: string
  /** The five-hour window as a wanted level; null where the account has no limits. */
  wanted: { stars: number; blink: boolean; reset: string | null; label: string; clean: string } | null
  money: string | null
  clock: string
  todLabel: string
  radio: { isOn: boolean; station: string; track: string; off: string; hint: string }
}

function footer(s: Snapshot): CardData['footer'] {
  const L = LABELS[s.env.lang]
  // Priority: busted, then a wanted level of three stars and up, then the import, then the countdown.
  const b = s.limits.mem.busted
  if (b) {
    const at = resetText(s, b.until)
    return { before: `${L.wanted.bustedShort} · `, strong: at ? L.wanted.outAt(at) : '—', after: '' }
  }
  const wv = wantedView(s)
  if (wv.stars >= 3) return { before: `${L.wanted.label} `, strong: starsText(wv.stars), after: wv.reset ? ` · ${wv.reset}` : '' }
  if (s.importing.active && s.importing.total > 0) {
    return { before: L.importing(s.importing.done, s.importing.total), strong: '', after: '' }
  }
  // A week after the release the countdown gives way to the all-time missions.
  return countdown(s.env, s.nowMs) ?? { before: `${L.rows.missions}: `, strong: fmtInt(allTime(s).sessions, s.env.lang), after: '' }
}

/** The countdown to the release, the day itself and the week after it; null once it is old news. */
function countdown(env: Env, nowMs: number): CardData['footer'] | null {
  const L = LABELS[env.lang]
  const days = daysUntilRelease(nowMs, env.offset)
  if (days > 0) return { before: L.countdown(''), strong: fmtDays(days, env.lang), after: '' }
  if (days === 0) return { before: '', strong: L.releaseDay, after: '' }
  if (days >= -7) return { before: L.released, strong: '', after: '' }
  return null
}

/** Lite's hello card: what changed, the countdown, and how to turn the game on or the mod off. */
export type LiteCard = {
  tod: TimeOfDay
  forLine: string
  title: string
  /** For a window that draws the look, and for a terminal or an editor, which draw none of it. */
  body: string
  bodyPlain: string
  news: CardData['footer'] | null
  hint: string
  /** The same, short enough for one line of a terminal. */
  hintShort: string
  /** The repository address and what the mod is, small, so a screenshot says both. */
  repo: string
}

export function liteCardData(env: Env, nowMs: number): LiteCard {
  const L = LABELS[env.lang]
  return {
    tod: timeOfDay(nowMs, env.offset),
    forLine: L.forClaudeCode,
    title: L.lite.title,
    body: L.lite.body,
    bodyPlain: L.lite.bodyPlain,
    news: countdown(env, nowMs),
    hint: L.lite.hint,
    hintShort: L.lite.hintShort,
    repo: `${REPO_URL} · ${L.lite.fan}`,
  }
}

function allTime(s: Snapshot) {
  return withLive(s.totals, s.live, s.nowMs, s.env.offset, s.live?.isResumed ?? false, s.hud.costUsd !== null)
}

export function cardData(s: Snapshot): CardData {
  const lang = s.env.lang
  const L = LABELS[lang]
  const tod = timeOfDay(s.nowMs, s.env.offset)
  const all = allTime(s)
  const today = liveDay(s.live, s.nowMs, s.env.offset)
  const week = weekNumbers(all, today)
  return {
    tod,
    greeting: greetingFor(lang, tod, s.env.player, s.live?.sessionId ?? today),
    forLine: L.forClaudeCode,
    tiles: [
      [fmtInt(week.sessions, lang), L.missionsWeek],
      [fmtCompact(week.tokens, lang), L.tokensWeek],
      [fmtSigned(week.added, lang), L.linesWeek],
      [fmtDays(week.streak, lang), L.streak],
    ],
    footer: footer(s),
    tipLabel: L.tip,
    tip: tipFor(lang, today, s.ui.tipShift),
    radio: s.radio.playing
      ? { isOn: true, text: `${RADIO_STATION.name} · ${currentTrack(s.radio)}` }
      : { isOn: false, text: `${RADIO_STATION.name} · ${L.radioHint}` },
    repo: REPO_URL,
  }
}

export function hudData(s: Snapshot, showCost: boolean, showWanted = true): HudData {
  const lang = s.env.lang
  const L = LABELS[lang]
  const tod = timeOfDay(s.nowMs, s.env.offset)
  const p = localParts(s.nowMs, s.env.offset)
  const armor = showWanted ? armorOf(s.limits) : null
  const wv = wantedView(s)
  return {
    tod,
    healthLabel: L.health,
    armorLabel: L.armor,
    health: healthPct(s.hud.contextTokens, s.hud.threshold, s.hud.contextPct),
    armor: armor ? Math.max(0, 100 - armor.pct) : null,
    showArmor: showWanted,
    // Before the first reading nobody knows; after it, no weekly window means no limit.
    noLimit: s.limits.hasData ? L.noLimit : '—',
    wanted: showWanted && wv.hasLimits ? { stars: wv.stars, blink: wv.blink, reset: wv.reset, label: L.wanted.label, clean: L.wanted.clean } : null,
    money: showCost ? fmtMoney(s.hud.costUsd ?? 0, lang) : null,
    clock: fmtClock(p.hours, p.minutes),
    todLabel: TOD_LABEL[lang][tod],
    radio: {
      isOn: s.radio.playing,
      station: RADIO_STATION.name,
      track: clip(currentTrack(s.radio), 24),
      off: L.radioOff,
      hint: L.radioHint,
    },
  }
}

export type Row = { label: string; value: string; share?: number }
export type PaneModel = {
  tab: Tab
  note: string | null
  importError: string | null
  tabs: { id: Tab; label: string }[]
  rows: Row[]
  session: Row[]
  empty: string | null
  districts: { name: string; sessions: number; label: string }[]
  current: string | null
}

export function paneModel(s: Snapshot): PaneModel {
  const lang = s.env.lang
  const L = LABELS[lang]
  const all = allTime(s)
  const today = liveDay(s.live, s.nowMs, s.env.offset)
  const week = weekNumbers(all, today)
  const sessionCost = s.hud.costUsd ?? 0
  const isPartial = all.costSessions < all.sessions
  const mark = (label: string) => (isPartial ? `${label}*` : label)
  const fam = favouriteFamily(all)
  const tabs = (['general', 'rap', 'arsenal', 'rides', 'map'] as const).map(id => ({ id, label: L.tabs[id] }))
  const live = s.live

  const session: Row[] = live
    ? [
        { label: L.rows.prompts, value: fmtInt(live.prompts, lang) },
        { label: L.rows.laundered, value: fmtCompact(live.tokensIn + live.tokensOut, lang) },
        { label: L.rows.spent, value: fmtMoney(sessionCost, lang) },
        { label: L.rows.tools, value: fmtInt(Object.values(live.tools).reduce((a, b) => a + b, 0), lang) },
        { label: L.rows.stolen, value: `${fmtSigned(live.added, lang)} / ${fmtSigned(-live.removed, lang)}` },
      ]
    : []

  let rows: Row[] = []
  let empty: string | null = null
  let note: string | null = null
  let districts: PaneModel['districts'] = []

  if (s.ui.tab === 'general') {
    rows = [
      { label: L.rows.missions, value: fmtInt(all.sessions, lang) },
      { label: L.rows.timeInMiami, value: fmtHours(all.activeMs, lang) },
      { label: L.rows.longestChase, value: fmtDuration(all.longestMs, lang) },
      { label: L.rows.laundered, value: fmtCompact(laundered(all), lang) },
      { label: L.rows.cacheRead, value: fmtCompact(all.cacheRead, lang) },
      {
        label: isPartial ? L.rows.spentPartial : L.rows.spent,
        value: fmtMoney(all.costUsd + sessionCost, lang),
      },
      { label: mark(L.rows.stolen), value: fmtSigned(all.added, lang) },
      { label: mark(L.rows.wrecked), value: fmtSigned(-all.removed, lang) },
      { label: L.rows.nightRuns, value: fmtInt(all.nightSessions, lang) },
      { label: L.rows.streak, value: fmtDays(week.streak, lang) },
      { label: L.rows.since, value: all.firstDay ? fmtDate(all.firstDay, lang) : '—' },
      { label: L.rows.favouriteRide, value: fam ? rideFor(fam, lang) : '—' },
    ]
    if (isPartial) note = L.partialCost
  } else if (s.ui.tab === 'rap') {
    const wv = wantedView(s)
    const armor = armorOf(s.limits)
    const busted = bustedData(s)
    rows = [
      {
        label: L.rows.wantedNow,
        // Before the first reading nothing is known; after it, no 5-hour window means there is none.
        value: busted ? L.wanted.bustedShort : wv.hasLimits ? `${starsText(wv.stars)}${wv.reset ? ` · ${wv.reset}` : ''}` : s.limits.hasData ? L.wanted.noLimits : '—',
      },
      {
        label: L.rows.armorNow,
        value: armor ? `${Math.round(100 - armor.pct)}%${armor.resetsAt !== null ? ` · ${resetText(s, armor.resetsAt)}` : ''}` : '—',
      },
      { label: L.rows.busts, value: fmtInt(all.busts, lang) },
      { label: L.rows.escapes, value: fmtInt(s.records.escapes, lang) },
      { label: L.rows.maxStars, value: s.records.maxStars > 0 ? starsText(s.records.maxStars) : '—' },
      { label: L.rows.medkits, value: fmtInt(all.medkits, lang) },
      { label: L.rows.medkitTokens, value: fmtCompact(all.medkitTokens, lang) },
      { label: L.rows.stalls, value: fmtInt(all.stalls, lang) },
    ]
  } else if (s.ui.tab === 'arsenal') {
    const top = ranked(all.tools, 9)
    const max = top[0]?.[1] ?? 1
    rows = top.map(([tool, n]) => ({ label: `${weaponFor(tool, lang)} · ${tool}`, value: fmtInt(n, lang), share: n / max }))
    if (!rows.length) empty = L.arsenalEmpty
  } else if (s.ui.tab === 'rides') {
    const top = ranked(all.models, 6)
    const sum = top.reduce((a, [, n]) => a + n, 0) || 1
    rows = top.map(([family, n]) => ({
      label: rideFor(modelFamily(family), lang),
      value: `${Math.round((n / sum) * 100)}% · ${L.responsesShort(fmtInt(n, lang))}`,
      share: n / sum,
    }))
    if (!rows.length) empty = L.ridesEmpty
  } else {
    const merged: Record<string, { s: number; ms: number }> = {}
    for (const [name, v] of Object.entries(all.projects)) {
      // The desktop app's throwaway folders ("scratch-2026-10-20-68f10d") are one district.
      const key = /^scratch-\d{4}-\d{2}-\d{2}/.test(name) ? L.scratch : name
      const d = (merged[key] ??= { s: 0, ms: 0 })
      d.s += v.s
      d.ms += v.ms
    }
    const top = Object.entries(merged)
      .sort((a, b) => b[1].s - a[1].s || a[0].localeCompare(b[0]))
      .slice(0, 6)
    districts = top.map(([name, v]) => ({ name, sessions: v.s, label: L.missionsShort(v.s) }))
    const max = top[0]?.[1].s ?? 1
    rows = top.map(([name, v]) => ({ label: name, value: `${L.missionsShort(v.s)} · ${fmtHours(v.ms, lang)}`, share: v.s / max }))
    if (!rows.length) empty = L.mapEmpty
  }

  const importError = s.importing.lastError ? L.command.importFailed(s.importing.lastError) : null
  return { tab: s.ui.tab, note, importError, tabs, rows, session, empty, districts, current: live?.project ?? null }
}

/** A text bar for the terminal: share 0..1 over `width` cells. */
export function textBar(share: number, width: number): string {
  const n = Math.max(0, Math.min(width, Math.round(share * width)))
  return '█'.repeat(n) + '░'.repeat(width - n)
}
