// The stats model: summing stored transcript summaries into Totals, adding the
// live session on top, and the weekly numbers the loading card shows. Pure functions.

import type { Counter, DayStat, Live, Totals } from '../../types'
import type { StoredSummary } from './history'
import { dayKey, isNightHour, lastDays, streak } from './time'
import { countBusts } from './wanted'

export type Family = 'opus' | 'sonnet' | 'haiku' | 'fable' | 'other'

/** "claude-opus-5-5" → "opus". */
export function modelFamily(model: string): Family {
  const m = model.toLowerCase()
  if (m.includes('opus')) return 'opus'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('haiku')) return 'haiku'
  if (m.includes('fable')) return 'fable'
  return 'other'
}

/** Keeps the tool names people recognise; MCP tools fold into one bucket. */
export function toolBucket(tool: string): string {
  return tool.startsWith('mcp__') ? 'MCP' : tool
}

export function emptyTotals(): Totals {
  return {
    sessions: 0,
    prompts: 0,
    responses: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheRead: 0,
    costUsd: 0,
    costSessions: 0,
    added: 0,
    removed: 0,
    activeMs: 0,
    longestMs: 0,
    nightSessions: 0,
    tools: {},
    models: {},
    projects: {},
    days: {},
    firstDay: null,
    cyrillic: 0,
    busts: 0,
    medkits: 0,
    medkitTokens: 0,
    stalls: 0,
  }
}

export function emptyLive(sessionId: string, project: string, startedAt: number, isNight: boolean): Live {
  return {
    sessionId,
    project,
    startedAt,
    prompts: 0,
    turns: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheRead: 0,
    added: 0,
    removed: 0,
    activeMs: 0,
    tools: {},
    models: {},
    isNight,
    hasCyrillic: false,
    isResumed: false,
    busts: 0,
    medkits: 0,
    medkitTokens: 0,
    stalls: 0,
  }
}

function addCounter(into: Counter, from: Readonly<Counter>, map: (k: string) => string = k => k): void {
  for (const [k, v] of Object.entries(from)) {
    const key = map(k)
    into[key] = (into[key] ?? 0) + (Number.isFinite(v) ? v : 0)
  }
}

function addDay(days: Record<string, DayStat>, key: string, s: number, k: number, a: number): void {
  const d = (days[key] ??= { s: 0, k: 0, a: 0 })
  d.s += s
  d.k += k
  d.a += a
}

/** Sessions with no prompt and no response are noise (an opened and closed window). */
export function isRealSession(s: StoredSummary): boolean {
  return s.u > 0 || s.n > 0
}

/** Rolls the work of a session's subagents into the totals: tokens, responses, tools, models. */
function addSubagents(t: Totals, s: StoredSummary, offsetMin: number): void {
  t.responses += s.n
  t.tokensIn += s.i + s.cw
  t.tokensOut += s.o
  t.cacheRead += s.cr
  addCounter(t.tools, s.tl, toolBucket)
  addCounter(t.models, s.m, modelFamily)
  if (s.t0 > 0) addDay(t.days, dayKey(s.t0 * 1000, offsetMin), 0, s.i + s.cw + s.o, 0)
}

/** Sums every stored summary. `offsetMin` places sessions on local days and hours. */
export function totalsFromSummaries(summaries: Readonly<Record<string, StoredSummary>>, offsetMin: number): Totals {
  const t = emptyTotals()
  let cy = 0
  const bustKeys: string[] = []
  for (const s of Object.values(summaries)) {
    // The rap sheet counts every transcript, subagents included; older entries may lack it.
    bustKeys.push(...(s.bk ?? []))
    t.medkits += (s.mka ?? 0) + (s.mkm ?? 0)
    t.medkitTokens += s.mks ?? 0
    t.stalls += s.st ?? 0
    if (s.sub) {
      addSubagents(t, s, offsetMin)
      continue
    }
    if (!isRealSession(s)) continue
    const k = s.i + s.cw + s.o
    const ms = s.act * 1000
    t.sessions += 1
    t.prompts += s.u
    cy += s.cy
    t.responses += s.n
    t.tokensIn += s.i + s.cw
    t.tokensOut += s.o
    t.cacheRead += s.cr
    if (s.hc) {
      t.costUsd += s.c
      t.costSessions += 1
      t.added += s.a
      t.removed += s.r
    }
    t.activeMs += ms
    t.longestMs = Math.max(t.longestMs, ms)
    addCounter(t.tools, s.tl, toolBucket)
    addCounter(t.models, s.m, modelFamily)
    if (s.t0 > 0) {
      const startMs = s.t0 * 1000
      if (isNightHour(startMs, offsetMin)) t.nightSessions += 1
      const day = dayKey(startMs, offsetMin)
      addDay(t.days, day, 1, k, s.hc ? s.a : 0)
      if (t.firstDay === null || day < t.firstDay) t.firstDay = day
    }
    const proj = (t.projects[s.p || '—'] ??= { s: 0, ms: 0 })
    proj.s += 1
    proj.ms += ms
  }
  t.cyrillic = t.prompts > 0 ? cy / t.prompts : 0
  t.busts = countBusts(bustKeys)
  t.days = trimDays(t.days, 400)
  return t
}

/** Keeps the newest `keep` days so the stored totals stay small. */
export function trimDays(days: Record<string, DayStat>, keep: number): Record<string, DayStat> {
  const keys = Object.keys(days).sort().reverse().slice(0, keep)
  const out: Record<string, DayStat> = {}
  for (const k of keys) {
    const d = days[k]
    if (d) out[k] = d
  }
  return out
}

/**
 * History plus the live session: what the stats pane shows as "all time".
 * `isResumed`: the history already holds this session (a --resume or --continue),
 * so only its new work is added, not another session or day.
 * `hasCost`: the live session's cost is known, so it does not make the total partial.
 */
export function withLive(
  base: Totals | null,
  live: Live | null,
  nowMs: number,
  offsetMin: number,
  isResumed = false,
  hasCost = false,
): Totals {
  const t: Totals = structuredCloneish(base ?? emptyTotals())
  if (!live || (live.prompts === 0 && live.turns === 0)) return t
  if (!isResumed) {
    t.sessions += 1
    if (hasCost) t.costSessions += 1
    if (live.isNight) t.nightSessions += 1
  }
  t.prompts += live.prompts
  t.busts += live.busts ?? 0
  t.medkits += live.medkits ?? 0
  t.medkitTokens += live.medkitTokens ?? 0
  t.stalls += live.stalls ?? 0
  t.responses += live.turns
  t.tokensIn += live.tokensIn
  t.tokensOut += live.tokensOut
  t.cacheRead += live.cacheRead
  t.added += live.added
  t.removed += live.removed
  t.activeMs += live.activeMs
  t.longestMs = Math.max(t.longestMs, live.activeMs)
  addCounter(t.tools, live.tools)
  addCounter(t.models, live.models)
  const day = dayKey(live.startedAt || nowMs, offsetMin)
  addDay(t.days, day, isResumed ? 0 : 1, live.tokensIn + live.tokensOut, live.added)
  if (t.firstDay === null || day < t.firstDay) t.firstDay = day
  const proj = (t.projects[live.project] ??= { s: 0, ms: 0 })
  if (!isResumed) proj.s += 1
  proj.ms += live.activeMs
  return t
}

function structuredCloneish<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export type Week = { sessions: number; tokens: number; added: number; streak: number }

/** The loading card's four numbers: last 7 local days including today. */
export function weekNumbers(t: Totals, today: string): Week {
  let sessions = 0, tokens = 0, added = 0
  for (const key of lastDays(today, 7)) {
    const d = t.days[key]
    if (!d) continue
    sessions += d.s
    tokens += d.k
    added += d.a
  }
  const active = Object.entries(t.days)
    .filter(([, d]) => d.s > 0 || d.k > 0)
    .map(([k]) => k)
  return { sessions, tokens, added, streak: streak(active, today) }
}

/** Entries of a counter, biggest first. */
export function ranked(c: Readonly<Counter>, limit: number): [string, number][] {
  return Object.entries(c)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

/** The model family with the most responses, or null. */
export function favouriteFamily(t: Totals): Family | null {
  const top = ranked(t.models, 1)[0]
  return top ? (top[0] as Family) : null
}

/** Laundered tokens: fresh input, cache writes and output; cache reads are not counted. */
export function laundered(t: Totals): number {
  return t.tokensIn + t.tokensOut
}

/** Lines changed by one Edit or Write result, from its structured patch. */
export function patchLines(result: unknown): { added: number; removed: number } {
  const out = { added: 0, removed: 0 }
  if (!result || typeof result !== 'object') return out
  const r = result as { structuredPatch?: unknown; staged?: unknown }
  if (r.staged === true || !Array.isArray(r.structuredPatch)) return out
  for (const hunk of r.structuredPatch) {
    const lines = (hunk as { lines?: unknown })?.lines
    if (!Array.isArray(lines)) continue
    for (const l of lines) {
      if (typeof l !== 'string') continue
      if (l.startsWith('+')) out.added += 1
      else if (l.startsWith('-')) out.removed += 1
    }
  }
  return out
}

/** Today's key for a live session, used to decide whether today counts for the streak. */
export function liveDay(live: Live | null, nowMs: number, offsetMin: number): string {
  return dayKey(live?.startedAt || nowMs, offsetMin)
}
