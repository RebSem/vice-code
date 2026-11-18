// Vice Code: a Miami look for Claude Code, in two modes.
// Lite (the default) is ambient: the app's colors and a skyline of symbols behind the
// conversation. Full adds the game: usage limits as a wanted level, a HUD above the
// prompt, Miami spinner phrases, gear names on tool rows, a radio and a stats pane.
// Everything here is drawing and counting; no tool call is changed.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BustKind, Counters, Env, Hud, Lang, LimitsState, Live, Records, SceneState, Tab, Totals, UiState, WantedMemory } from '../types'
import { mapSvg, meterSvg, starsSvg, TONE_KEY, toneFor, wrap } from './lib/card'
import { TOASTS, TOD_LABEL } from './lib/content'
import { clip, fmtCompact } from './lib/format'
import type { FileSummary, StoredSummary } from './lib/history'
import { AWK_PROGRAM, emptySummary, mergeSummaries, parseSummary, projectName, summarizeText, toStored } from './lib/history'
import { LABELS, fmtDate } from './lib/i18n'
import type { Candidate, FileRef } from './lib/importer'
import { changed, compactStored, FILES_KEY, subCandidate } from './lib/importer'
import { look } from './lib/look'
import type { Snapshot } from './lib/model'
import { bustedData, bustedRowId, cardData, hash, hudData, isTooOld, liteCardData, paneModel, pick, RADIO_STATION, spinnerWord, starsText, textBar, tipFor, wantedLabel, weaponFor } from './lib/model'
import { sceneCells } from './lib/raster'
import { emptyLive, liveDay, modelFamily, patchLines, toolBucket, totalsFromSummaries } from './lib/stats'
import { sound } from './lib/synth'
import type { Stock } from './lib/tiles'
import { backdropSvg, bustedSvg, stripSvg } from './lib/tiles'
import { isNightHour, localOffsetMinutes, timeOfDay } from './lib/time'
import type { LimitReading, Limits, WantedEvent } from './lib/wanted'
import { diffLimits, emptyMemory, fmtResetAt, fullKeys, healthPct, mergeMemory, readLimits, rejectedBy, starsFor, windowKey } from './lib/wanted'

const PANE = 'vice-stats'
const RECORDS_KEY = 'records'
const WANTED_KEY = 'wanted'
const BACKDROP_KEY = 'backdrop'
const LEGEND_KEY = 'legend'
/** The person's own choices, made with /vice; each wins over the setting of the same name. */
const MODE_KEY = 'mode'
const OFF_KEY = 'off'
const PAPER_KEY = 'paper'
/** Set once the first-run card was shown where the scene is drawn. */
const WELCOMED_KEY = 'welcomed'
/** The language the person was last seen writing in, so the next session greets in it. */
const LANG_KEY = 'lang'
/** Ids of the rows the mod places in the conversation, and of its backdrop. */
const WELCOME = 'welcome'
const HELLO = 'hello'
const BUSTED = 'busted'
const BACKDROP = 'sunset'
/** The lights flash this long after a new wanted level or a bust, then hold still. */
const FLASH_MS = 13_000
/** Street talk keeps this far from its last line, however many turns went by. */
const TALK_GAP_MS = 20 * 60_000

const totals = atom({ plugin: 'vice-code', key: 'totals' } as const, null)
const live = atom({ plugin: 'vice-code', key: 'live' } as const, null)
const hud = atom({ plugin: 'vice-code', key: 'hud' } as const, { contextPct: null, contextTokens: null, threshold: null, window: null, costUsd: null })
const importing = atom({ plugin: 'vice-code', key: 'importing' } as const, { active: false, done: 0, total: 0, lastError: null })
const ui = atom({ plugin: 'vice-code', key: 'ui' } as const, { tab: 'general', tipShift: 0, flashUntil: 0 })
const radio = atom({ plugin: 'vice-code', key: 'radio' } as const, { playing: false, track: 0 })
const env = atom({ plugin: 'vice-code', key: 'env' } as const, { lang: 'en', player: '', offset: 0 })
const tick = atom({ plugin: 'vice-code', key: 'tick' } as const, 0)
const seed = atom({ plugin: 'vice-code', key: 'seed' } as const, 0)
const limits = atom({ plugin: 'vice-code', key: 'limits' } as const, { short: null, week: null, spend: null, hasData: false, mem: emptyMemory() })
const records = atom({ plugin: 'vice-code', key: 'records' } as const, { escapes: 0, maxStars: 0 })
const counters = atom({ plugin: 'vice-code', key: 'counters' } as const, { mainTurns: 0, costBaseline: null })
/** What the backdrop is drawn from. It changes only when the picture must, so its motion is not restarted. */
const scene = atom({ plugin: 'vice-code', key: 'scene' } as const, { tod: 'sunset', paper: 'auto', isFull: false, rev: 0 })

type Options = {
  mode: 'lite' | 'full'
  colors: boolean
  language: 'auto' | 'ru' | 'en'
  playerName: string
  weapons: boolean
  spinner: boolean
  toasts: boolean
  toastEvery: number
  showCost: boolean
  importHistory: boolean
  radioVolume: number
  radioUrl: string
  wanted: boolean
  sounds: boolean
  backdrop: boolean
  paper: Stock
  hud: 'full' | 'compact' | 'off'
}

function readOptions(o: Readonly<Record<string, unknown>>): Options {
  const lang = o.language === 'ru' || o.language === 'en' ? o.language : 'auto'
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    mode: o.mode === 'full' ? 'full' : 'lite',
    colors: b(o.colors, true),
    language: lang,
    playerName: s(o.playerName),
    weapons: b(o.weapons, true),
    spinner: b(o.spinner, true),
    toasts: b(o.toasts, true),
    toastEvery: Math.max(1, Math.round(n(o.toastEvery, 12))),
    showCost: b(o.showCost, true),
    importHistory: b(o.importHistory, true),
    radioVolume: Math.max(0, Math.min(2, n(o.radioVolume, 0.6))),
    radioUrl: s(o.radioUrl),
    wanted: b(o.wanted, true),
    sounds: b(o.sounds, false),
    backdrop: b(o.backdrop, true),
    paper: o.paper === 'light' || o.paper === 'dark' ? o.paper : 'auto',
    hud: o.hud === 'compact' || o.hud === 'off' ? o.hud : 'full',
  }
}

// ---------- history import (needs $, so it lives in this file) ----------

/** Where Claude Code keeps transcripts: $CLAUDE_CONFIG_DIR/projects or ~/.claude/projects. */
async function projectsDir($: EngineInterface): Promise<string | null> {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')
  if (config) return `${config.replace(/[\\/]+$/, '')}/projects`
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  if (home) return `${home.replace(/[\\/]+$/, '')}/.claude/projects`
  return null
}

/** Every .jsonl under `dir`, `depth` levels down (workflows nest their agents in subagents/). */
async function walkJsonl($: EngineInterface, dir: string, depth: number, out: FileRef[]): Promise<void> {
  let entries
  try {
    entries = await $.fs.list(dir)
  } catch {
    return
  }
  for (const f of entries) {
    const path = `${dir}/${f.name}`
    if (f.kind === 'file' && f.name.endsWith('.jsonl')) out.push({ path, size: f.size, mtime: f.mtimeMs })
    else if (f.kind === 'dir' && depth > 0) await walkJsonl($, path, depth - 1, out)
  }
}

/**
 * Every <project>/<session>.jsonl under `dir`, plus one entry per session for all its
 * subagent transcripts (<project>/<session>/subagents/**). The live session is left out:
 * it is counted live and imported after it ends.
 */
async function listTranscripts($: EngineInterface, dir: string, skipSessionId: string | null): Promise<Candidate[]> {
  if (!(await $.fs.exists(dir))) return []
  const out: Candidate[] = []
  for (const project of await $.fs.list(dir)) {
    if (project.kind !== 'dir') continue
    const pdir = `${dir}/${project.name}`
    let entries
    try {
      entries = await $.fs.list(pdir)
    } catch {
      continue
    }
    for (const f of entries) {
      if (f.kind === 'file' && f.name.endsWith('.jsonl')) {
        const sid = f.name.slice(0, -'.jsonl'.length)
        if (sid === skipSessionId) continue
        out.push({ key: `${project.name}/${f.name}`, paths: [`${pdir}/${f.name}`], sid, isSub: false, size: f.size, mtime: f.mtimeMs })
      } else if (f.kind === 'dir' && f.name !== skipSessionId) {
        const files: FileRef[] = []
        await walkJsonl($, `${pdir}/${f.name}/subagents`, 4, files)
        if (files.length) out.push(subCandidate(`${project.name}/${f.name}/subagents`, files))
      }
    }
  }
  return out
}

/** awk first (any size); the in-module parser for transcripts $.fs can read. */
async function summarizeChunk($: EngineInterface, paths: readonly string[], sid: string): Promise<FileSummary | null> {
  try {
    const run = await $.process.run(['awk', '-v', `sid=${sid}`, AWK_PROGRAM, ...paths], { env: { LC_ALL: 'C' }, timeoutMs: 300_000 })
    if (run.exitCode === 0 && !run.isStdoutTruncated) {
      const s = parseSummary(run.stdout)
      if (s) return s
    }
  } catch {
    // no awk, or processes are not allowed here: fall through
  }
  const texts: string[] = []
  for (const path of paths) {
    try {
      texts.push(await $.fs.read(path))
    } catch {
      return null
    }
  }
  return summarizeText(texts.join('\n'), sid)
}

/**
 * One stored summary per candidate. A transcript that cannot be read is stored empty
 * with its size and mtime, so it is not tried again every session.
 */
async function summarize($: EngineInterface, c: Candidate): Promise<StoredSummary> {
  let total: FileSummary | null = null
  for (let i = 0; i < c.paths.length; i += 200) {
    const part = await summarizeChunk($, c.paths.slice(i, i + 200), c.sid)
    if (!part) return toStored(emptySummary(), c.size, c.mtime, c.isSub)
    total = total ? mergeSummaries(total, part) : part
  }
  return toStored(total ?? emptySummary(), c.size, c.mtime, c.isSub)
}

async function loadStored($: EngineInterface): Promise<Record<string, StoredSummary>> {
  const v = await $.store.get(FILES_KEY)
  return v && typeof v === 'object' ? (v as Record<string, StoredSummary>) : {}
}

/**
 * Saves the summaries. Past the store's 4 MiB it drops empty entries and then keeps a
 * shorter and shorter window of history (400, 180, 90, 30 days) until the set fits.
 */
async function saveStored($: EngineInterface, stored: Record<string, StoredSummary>): Promise<void> {
  const nowSec = Math.floor((await $.clock.now()) / 1000)
  for (const keepDays of [0, 400, 180, 90, 30]) {
    if (keepDays) compactStored(stored, nowSec, keepDays)
    try {
      await $.store.set(FILES_KEY, stored)
      return
    } catch (err) {
      if (keepDays === 30) throw err
    }
  }
}

// Module-scope handles: a hot reload drops them along with the timers.
let opts: Options = readOptions({})
let radioStop: AbortController | null = null
let isImporting = false
let turnErrors = 0
let turnStartedAt = 0
/** True in a session nobody watches (claude -p, an SDK script, an app before its window attaches) or on an engine too old: the mod stays out of it. */
let inert = false
/** Where the start stands: `dormant` waits for a window, `awake` has set the mod up. */
let phase: 'starting' | 'dormant' | 'awake' = 'starting'
/** True while the backdrop was set but no surface drew it yet: the first turn asks once more. */
let isBackdropPending = false
/** True once a surface draws the backdrop: the welcome card then needs no picture of its own. */
let isBackdropDrawn = false
let resetTimer: { cancel: () => void } | null = null
/** The game is on: wanted level, HUD, gear, spinner, stats. False is Lite, the look alone. */
let isFull = false
/** The person turned the mod off with /vice off: it draws and counts nothing until /vice on. */
let isOff = false
/** The stock the scene prints on: follows the window, or the one the person picked. */
let paper: Stock = 'auto'
/** True while the first card of a conversation waits for a surface to attach. */
let isGreetingPending = false
/** True when the engine took the colors with the last look; an engine from before them takes the scene alone. */
let hasColors = false
/** How many prompts of a dormant session have looked at the roster, and how many may. */
let wakeChecks = 0
const WAKE_CHECKS = 5
/** True once the first turn of a conversation has asked for the look again: a terminal never draws it, so once is enough. */
let hasRetriedLook = false
/** Prompts in Cyrillic and in other letters since the mod woke: the remembered language follows a habit, not one pasted line. */
let seenRu = 0
let seenOther = 0
let importTimer: { cancel: () => void } | null = null

async function snapshot($: EngineInterface): Promise<Snapshot> {
  return {
    env: await read($, env),
    ui: await read($, ui),
    totals: await read($, totals),
    live: await read($, live),
    hud: await read($, hud),
    importing: await read($, importing),
    radio: await read($, radio),
    limits: await read($, limits),
    records: await read($, records),
    nowMs: await $.clock.now(),
  }
}

async function offsetMinutes($: EngineInterface): Promise<number> {
  try {
    const r = await $.process.run(['date', '+%z'], { timeoutMs: 3000 })
    const m = /^([+-])(\d{2})(\d{2})/.exec(r.stdout.trim())
    if (r.exitCode === 0 && m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
  } catch {
    // no `date`: use the runtime's idea of the zone
  }
  return localOffsetMinutes()
}

/** The option, else a cached name, else the macOS account's first name, else the login. */
async function playerName($: EngineInterface): Promise<string> {
  if (opts.playerName) return clip(opts.playerName, 18)
  const cached = await $.store.get('player')
  if (typeof cached === 'string' && cached) return cached
  let name = ''
  try {
    const r = await $.process.run(['id', '-F'], { timeoutMs: 2000 })
    if (r.exitCode === 0) name = r.stdout.trim().split(/\s+/)[0] ?? ''
  } catch {
    // not macOS
  }
  if (!name) name = (await $.env.get('USER')) || (await $.env.get('USERNAME')) || 'player'
  name = clip(name, 18)
  await safeSet($, 'player', name)
  return name
}

/** The setting, else what the person writes in (now, in their history, last time), else the system's language. */
function pickLang(t: Totals | null, envLang: string | undefined, isLiveCyrillic: boolean, seen: Lang | null = null): Lang {
  if (opts.language !== 'auto') return opts.language
  if (isLiveCyrillic) return 'ru'
  if (t && t.prompts >= 10) return t.cyrillic >= 0.3 ? 'ru' : 'en'
  if (seen) return seen
  return /^ru/i.test(envLang ?? '') ? 'ru' : 'en'
}

/** The language of the person's prompts as an earlier session saw it. */
async function seenLang($: EngineInterface): Promise<Lang | null> {
  try {
    const v = await $.store.get(LANG_KEY)
    return v === 'ru' || v === 'en' ? v : null
  } catch {
    return null
  }
}

/**
 * A choice made with /vice. It holds until the setting of the same name is changed
 * after it: whichever the person touched last wins.
 */
async function choice<T extends string | boolean>($: EngineInterface, key: string, setting: T, values: readonly T[]): Promise<T> {
  try {
    const c = (await $.store.get(key)) as { v?: unknown; over?: unknown } | undefined
    if (c && typeof c === 'object' && c.over === setting && values.includes(c.v as T)) return c.v as T
    // The setting moved on after the choice: the choice is spent, and must not come back
    // if the setting is ever put back.
    if (c !== undefined) await $.store.delete(key)
  } catch {
    // no store: the setting decides
  }
  return setting
}

async function choose<T extends string | boolean>($: EngineInterface, key: string, value: T, setting: T): Promise<void> {
  await safeSet($, key, { v: value, over: setting })
}

/** Reads what the person chose: the mode, the paper, and whether the mod is off altogether. */
async function loadChoices($: EngineInterface): Promise<void> {
  isFull = (await choice($, MODE_KEY, opts.mode, ['lite', 'full'] as const)) === 'full'
  paper = await choice<Stock>($, PAPER_KEY, opts.paper, ['auto', 'light', 'dark'])
  try {
    isOff = (await $.store.get(OFF_KEY)) === true
  } catch {
    isOff = false
  }
}

/** Brings the backdrop's inputs up to date. The atom is written only when one changed, so a still picture is not redrawn. */
async function syncScene($: EngineInterface, isForced = false): Promise<void> {
  const tod = timeOfDay(await $.clock.now(), (await read($, env)).offset)
  const cur = await read($, scene)
  if (!isForced && cur.tod === tod && cur.paper === paper && cur.isFull === isFull) return
  await update($, scene, (v): SceneState => ({ tod, paper, isFull, rev: v.rev + 1 }))
}

async function envLang($: EngineInterface): Promise<string | undefined> {
  return (await $.env.get('LC_ALL')) || (await $.env.get('LANG'))
}

async function recompute($: EngineInterface, stored: Readonly<Record<string, StoredSummary>>): Promise<Totals> {
  const offset = (await read($, env)).offset
  const t = totalsFromSummaries(stored, offset)
  await update($, totals, () => t)
  // A resumed session is already in the history: from now on only its new work is added.
  const lv = await read($, live)
  if (lv && !lv.isResumed && Object.keys(stored).some(k => k.endsWith(`/${lv.sessionId}.jsonl`))) {
    await update($, live, v => (v ? { ...v, isResumed: true } : v))
  }
  return t
}

/** `isWhole` reads every transcript again; otherwise only the new and changed ones. */
async function runImport($: EngineInterface, isWhole: boolean): Promise<void> {
  if (isImporting) return
  isImporting = true
  try {
    const dir = await projectsDir($)
    if (!dir) return
    const lv = await read($, live)
    const stored = await loadStored($)
    const all = await listTranscripts($, dir, lv?.sessionId ?? null)
    // A full recount reads every file on disk again but keeps what Claude Code already deleted.
    // Summaries from an older version of the mod lack the rap sheet: read those files again too.
    const todo = isWhole
      ? [...all].sort((a, b) => b.mtime - a.mtime)
      : [...changed(all, stored), ...all.filter(c => stored[c.key] && !Array.isArray(stored[c.key]?.bk))]
    const isFirst = Object.keys(stored).length === 0 && todo.length > 0
    if (!todo.length) return
    await update($, importing, () => ({ active: true, done: 0, total: todo.length, lastError: null }))
    let done = 0
    for (const c of todo) {
      // The game was turned off while the history was being read: stop, Lite reads none.
      if (!isFull || isOff) return
      stored[c.key] = await summarize($, c)
      done += 1
      if (done % 8 === 0 || done === todo.length) {
        await saveStored($, stored)
        await recompute($, stored)
        await update($, importing, v => ({ ...v, done }))
      }
    }
    const t = await recompute($, stored)
    if (!isFull || isOff) return
    const lang = pickLang(t, await envLang($), (await read($, live))?.hasCyrillic ?? false)
    if (lang !== (await read($, env)).lang) await update($, env, (v): Env => ({ ...v, lang }))
    if (isFirst && t.sessions > 0) {
      $.ui.toast(LABELS[lang].imported(t.sessions, t.firstDay ? fmtDate(t.firstDay, lang) : '—'), { timeoutMs: 8000 })
    }
  } catch (err) {
    await update($, importing, v => ({ ...v, lastError: String(err).slice(0, 200) }))
  } finally {
    await update($, importing, v => ({ ...v, active: false }))
    isImporting = false
  }
}

async function loadRecords($: EngineInterface): Promise<Records> {
  const v = (await $.store.get(RECORDS_KEY)) as Partial<Records> | undefined
  return {
    escapes: typeof v?.escapes === 'number' ? v.escapes : 0,
    maxStars: typeof v?.maxStars === 'number' ? v.maxStars : 0,
    // The window last counted as an escape: every session that sees it end counts it once.
    ...(typeof v?.escapedKey === 'string' ? { escapedKey: v.escapedKey } : {}),
  }
}

async function bumpRecords($: EngineInterface, change: (r: Records) => Records): Promise<void> {
  const next = change(await loadRecords($))
  await safeSet($, RECORDS_KEY, next)
  await update($, records, () => next)
}

/** Sets the session up in the mode that is on; a mod the person turned off sets up nothing. */
async function startSession($: EngineInterface, isFresh: boolean, mustGreet = false): Promise<void> {
  if (isOff) return
  hasRetriedLook = false
  if (isFull) await startFull($, isFresh, mustGreet)
  else await startLite($, isFresh)
}

/**
 * Lite: the look alone. Nothing is read from the history and nothing is counted; the only
 * things asked of the machine are its time zone and its language.
 */
async function startLite($: EngineInterface, isFresh: boolean): Promise<void> {
  const offset = await offsetMinutes($)
  const lang = pickLang(null, await envLang($), false, await seenLang($))
  await update($, env, (v): Env => ({ ...v, lang, offset }))
  // /clear resets session state but not a radio loop that is still playing: match the button to it.
  const playing = radioStop !== null
  if ((await read($, radio)).playing !== playing) await update($, radio, v => ({ ...v, playing }))
  await syncScene($)
  await applyLook($)
  await greetLite($, isFresh)
}

/**
 * Lite's card. Where the scene stands behind the conversation it is shown once, after
 * install, to say what changed and how to turn it off. Where nothing else of the look is
 * drawn (a terminal, an editor) the banner is the look, so it opens each new conversation.
 * `isLate`: the conversation has begun; only the once-after-install card may still come.
 */
async function greetLite($: EngineInterface, isFresh: boolean, isLate = false): Promise<void> {
  const sessionId = await $.session.id()
  if (!isFresh && (await read($, ui)).greeted === sessionId) return
  const greeted = () => update($, ui, (v): UiState => ({ ...v, greeted: sessionId }))
  // A resumed conversation already has its history: no card on top of it.
  if (!isLate && (await $.session.turns()) > 0) {
    await greeted()
    return
  }
  if (isBackdropDrawn) {
    await greeted()
    if (await $.store.get(WELCOMED_KEY).catch(() => undefined)) return
    // Marked as shown only once it stands, so a card that failed to place comes next time.
    if (await placeWelcome($, HELLO)) await safeSet($, WELCOMED_KEY, 1)
    return
  }
  if (isLate) return
  let surfaces: readonly string[] = []
  try {
    surfaces = await $.session.surfaces()
  } catch {
    // an engine without the roster: nobody to ask, so wait for the first sign of a window
  }
  // No window yet: session.attach or the first turn asks again.
  if (!surfaces.length) {
    isGreetingPending = true
    return
  }
  await greeted()
  await placeWelcome($, HELLO)
}

/** Full: the game. Counts the session, reads the limits, and opens with the stats card. */
async function startFull($: EngineInterface, isFresh: boolean, mustGreet = false): Promise<void> {
  let isNew = false
  const now = await $.clock.now()
  const offset = await offsetMinutes($)
  const sessionId = await $.session.id()
  const root = await $.session.root()
  const current = await read($, live)
  if (isFresh || !current || current.sessionId !== sessionId) {
    // --resume and --continue bring prompts with them: go straight to the HUD.
    const isResumed = (await $.session.turns()) > 0
    await update($, live, () => emptyLive(sessionId, projectName(root), now, isNightHour(now, offset)))
    // A new conversation opens with the welcome card; a resumed one already has its history.
    isNew = !isResumed
    // A resumed session's cost ledger starts at its first launch: count from here on.
    const base = isResumed ? await currentCost($) : null
    await update($, counters, (): Counters => ({ mainTurns: 0, costBaseline: base }))
  }
  await update($, env, v => ({ ...v, offset }))
  const t = await recompute($, await loadStored($))
  const lang = pickLang(t, await envLang($), (await read($, live))?.hasCyrillic ?? false, await seenLang($))
  const player = await playerName($)
  await update($, env, (v): Env => ({ ...v, lang, player }))
  const rec = await loadRecords($)
  await update($, records, () => rec)
  await loadWanted($)
  // /clear resets session state but not a radio loop that is still playing: match the button to it.
  const playing = radioStop !== null
  if ((await read($, radio)).playing !== playing) await update($, radio, v => ({ ...v, playing }))
  await refreshUsage($, true)
  // The look first: the welcome card leaves its own picture out where the scene is already behind it.
  await syncScene($)
  await applyLook($)
  if (isNew || mustGreet) await placeWelcome($, WELCOME)
  // A bust that is still in force shows in the new conversation too.
  await placeBusted($)
}

/** A store write that cannot fail its caller: a full store (4 MiB) must not stop a session from starting. */
async function safeSet($: EngineInterface, key: string, value: unknown): Promise<void> {
  try {
    await $.store.set(key, value)
  } catch (err) {
    $.ui.log(`vice-code: ${key} was not saved: ${String(err).slice(0, 120)}`)
  }
}

/**
 * A card is a row in the conversation, like the engine's own notices: it scrolls away by
 * itself. `kind` is the game's stats card (WELCOME) or Lite's hello (HELLO); a row keeps
 * its kind whatever mode is on later.
 */
async function placeWelcome($: EngineInterface, kind: string): Promise<boolean> {
  try {
    await $.ui.place({ id: `${kind}-${await $.clock.now()}` })
    return true
  } catch (err) {
    $.ui.log(`vice-code: the welcome card was not placed: ${String(err).slice(0, 120)}`)
    return false
  }
}

/** The busted card stands where Claude went quiet; one row per bust. */
async function placeBusted($: EngineInterface): Promise<void> {
  const b = (await read($, limits)).mem.busted
  if (!b || !opts.wanted) return
  try {
    await $.ui.place({ id: bustedRowId(b) })
  } catch (err) {
    $.ui.log(`vice-code: the busted card was not placed: ${String(err).slice(0, 120)}`)
  }
}

/** Starts the lights and asks for one more drawing when they are due to stop. */
async function flashLights($: EngineInterface): Promise<void> {
  const until = (await $.clock.now()) + FLASH_MS
  await update($, ui, (v): UiState => ({ ...v, flashUntil: until }))
  $.clock.after(FLASH_MS + 300, () => {
    void update($, tick, n => n + 1)
  })
}

/** The person's last word (/vice backdrop) or the setting, whichever came later. */
async function isBackdropOn($: EngineInterface): Promise<boolean> {
  return choice($, BACKDROP_KEY, opts.backdrop, [true, false])
}

/**
 * Sends the look: the app's colors and the scene behind the conversation, in one call,
 * since a set names the whole theme. The desktop and mobile apps draw it.
 * Resolves null when a surface draws it, else why not.
 */
async function applyLook($: EngineInterface): Promise<string | null> {
  const hasScene = await isBackdropOn($)
  const wasDrawn = isBackdropDrawn
  const hadColors = hasColors
  // The newest engines read the scene's name as `scene`, the ones before them as `id`.
  // One shape with both serves the engines that drop a member they do not know; the
  // shape with `scene` alone serves one that refuses it. The glass has no tint of its
  // own: the panels take the look's colors.
  const glass = { blur: 12, opacity: 0.55 }
  const scenes = hasScene ? [{ backdrop: { scene: BACKDROP, id: BACKDROP, glass } }, { backdrop: { scene: BACKDROP, glass } }] : [{}]
  // Both modes of the colors always go, and no mode is asked for: the window keeps its
  // own, and the paper a person picks changes the scene alone.
  const colors = opts.colors ? { colors: look().colors } : {}
  // An engine from before the colors refuses them: it still gets the scene.
  const tries = [...scenes.map(sc => ({ ...colors, ...sc })), ...(opts.colors ? scenes : [])].filter(attempt => Object.keys(attempt).length > 0)
  // Worked out in locals and written once at the end: two calls can overlap (a window
  // attaching while the mod wakes), and neither may see the other's half-done state.
  let why = 'off'
  let isSet = false
  let isShown = false
  let withColors = false
  for (const attempt of tries) {
    try {
      const r = await $.theme.set(attempt as never)
      // "Drawn" means a client said it draws themes. A window that joined by simply
      // asking to draw is on the roster without having said so, and the engine hands it
      // the theme all the same: a session that is an app window alone counts as shown.
      isSet = true
      isShown = r.isDrawn || (await isAppOnly($))
      withColors = 'colors' in attempt
      why = isShown || r.isDrawn ? '' : r.reason
      break
    } catch (err) {
      why = String(err).slice(0, 120)
    }
  }
  isBackdropPending = isSet && !isShown
  isBackdropDrawn = isShown && hasScene
  hasColors = isSet && withColors
  // A card that drew its own banner for want of a scene lets go of it now, and the
  // reverse; a card that spoke of the colors follows what the engine took.
  if (wasDrawn !== isBackdropDrawn || hadColors !== hasColors) await syncScene($, true)
  return why === '' ? null : why
}

/**
 * True when the session is an app window and nothing else: a desktop or mobile client on
 * the roster and no terminal. With a terminal there too, the terminal stays the measure:
 * it draws no look, so it keeps the card that opens each conversation.
 */
async function isAppOnly($: EngineInterface): Promise<boolean> {
  try {
    const roster = await $.session.surfaces()
    return !roster.includes('terminal') && roster.some(s => s === 'desktop' || s === 'mobile')
  } catch {
    return false
  }
}

/**
 * A dormant mod wakes at `session.attach`. This is the second chance: if a window got onto
 * the roster without that event reaching this module, one of the person's first prompts
 * finds it there and wakes the mod. A run nobody watches has an empty roster and stays
 * asleep; after a few prompts it is no longer asked, so a long script pays nothing for it.
 */
async function wakeIfWatched($: EngineInterface): Promise<void> {
  if (phase !== 'dormant' || wakeChecks >= WAKE_CHECKS) return
  wakeChecks += 1
  let isWatched = false
  try {
    isWatched = (await $.session.surfaces()).length > 0
  } catch {
    // no roster to read: stay asleep
  }
  if (!isWatched || phase !== 'dormant') return
  phase = 'awake'
  inert = false
  await wake($)
}

/** Reads the history a moment after the session is up; one reading at a time. */
function scheduleImport($: EngineInterface): void {
  if (!opts.importHistory) return
  importTimer?.cancel()
  importTimer = $.clock.after(1500, () => {
    void runImport($, false).catch(() => undefined)
  })
}

/** Said once after install: what the game's meters stand for. */
async function sayLegend($: EngineInterface): Promise<void> {
  if (!opts.wanted || (await $.store.get(LEGEND_KEY).catch(() => 1))) return
  $.ui.toast(LABELS[(await read($, env)).lang].legend, { timeoutMs: 15_000 })
  await safeSet($, LEGEND_KEY, 1)
}

/** Turns the game on, from the command or from the card's button. */
async function enterFull($: EngineInterface): Promise<void> {
  if (isFull || isOff) return
  isFull = true
  try {
    await choose($, MODE_KEY, 'full', opts.mode)
    scheduleImport($)
    // A game that was on earlier in this conversation picks up its counts and its card; a new one opens with the card.
    const lv = await read($, live)
    const isBack = lv !== null && lv.sessionId === (await $.session.id())
    await startFull($, false, !isBack)
    await sayLegend($)
  } catch (err) {
    $.ui.log(`vice-code: the game did not start: ${String(err).slice(0, 200)}`)
  }
  await update($, tick, n => n + 1)
}

/** Back to the look alone: the game's timers stop, what it counted stays in the store. */
async function enterLite($: EngineInterface): Promise<void> {
  if (!isFull || isOff) return
  isFull = false
  await choose($, MODE_KEY, 'lite', opts.mode)
  importTimer?.cancel()
  importTimer = null
  resetTimer?.cancel()
  resetTimer = null
  await syncScene($)
  await update($, tick, n => n + 1)
}

/** /vice off: the look is cleared and every hook steps aside, in this session and the next ones. */
async function turnOff($: EngineInterface): Promise<void> {
  isOff = true
  await safeSet($, OFF_KEY, true)
  radioStop?.abort()
  radioStop = null
  importTimer?.cancel()
  importTimer = null
  resetTimer?.cancel()
  resetTimer = null
  isBackdropPending = false
  isBackdropDrawn = false
  isGreetingPending = false
  // Asked for by the person, so clearing the session's one theme is theirs to decide.
  await $.theme.clear().catch(() => undefined)
  await update($, radio, v => ({ ...v, playing: false }))
  await update($, tick, n => n + 1)
}

async function turnOn($: EngineInterface): Promise<void> {
  isOff = false
  await safeSet($, OFF_KEY, false)
  if (isFull) scheduleImport($)
  await startSession($, false)
  if (isFull) await sayLegend($)
  await update($, tick, n => n + 1)
}

/** Reads usage now; `withThreshold` also asks where auto-compact kicks in (estimated locally). */
async function refreshUsage($: EngineInterface, withThreshold: boolean): Promise<void> {
  try {
    const u = withThreshold ? await $.session.usage({ breakdown: 'summary' }) : await $.session.usage()
    const threshold = u.context.breakdown?.autoCompactThreshold ?? null
    if (withThreshold) await update($, hud, (v): Hud => ({ ...v, threshold: threshold ?? v.threshold, window: u.context.window }))
    await applyUsage($, u.context.percent ?? null, u.context.tokens ?? null, u.cost?.usd)
    await applyLimits($, u.rateLimits)
  } catch {
    // usage not available yet
  }
}

async function applyUsage($: EngineInterface, contextPct: number | null, tokens: number | null, costUsd: number | undefined): Promise<void> {
  const c = await read($, counters)
  if (costUsd !== undefined && c.costBaseline === null) await update($, counters, (v): Counters => ({ ...v, costBaseline: 0 }))
  const base = (await read($, counters)).costBaseline ?? 0
  const h = await update($, hud, (v): Hud => ({
    ...v,
    contextPct: contextPct ?? v.contextPct,
    contextTokens: tokens ?? v.contextTokens,
    costUsd: costUsd !== undefined ? Math.max(0, costUsd - base) : v.costUsd,
  }))
  // Health running low: one warning per conversation, again after a medkit.
  const health = healthPct(h.contextTokens, h.threshold, h.contextPct)
  const lim = await read($, limits)
  if (health !== null && health <= 15 && !lim.mem.healthWarned && opts.wanted) {
    await update($, limits, (v): LimitsState => ({ ...v, mem: { ...v.mem, healthWarned: true } }))
    $.ui.toast(LABELS[(await read($, env)).lang].wanted.healthLow(`${Math.round(health)}%`), { timeoutMs: 8000 })
  }
}

/** Takes a reading of the usage windows and turns changes into the wanted system's events. */
async function applyLimits($: EngineInterface, readings: readonly LimitReading[]): Promise<void> {
  // A reading that was in flight when the game was turned off says nothing and arms nothing.
  if (!isFull || isOff) return
  let model = ''
  try {
    model = await $.session.model()
  } catch {
    // no model yet
  }
  const now = await $.clock.now()
  const next = readLimits(readings)
  const stored = await storedWanted($)
  let events: WantedEvent[] = []
  // One read-modify-write, so a bust from a rejected request and a reading cannot overwrite each other.
  // update() may run the change again on a version miss: only the last run's events count.
  const after = await update($, limits, (v): LimitsState => {
    events = []
    // No windows yet (or an API-key account): nothing to say. After data, an empty list means the windows ended.
    if (!readings.length && !v.hasData) return v
    const r = diffLimits(stored ? mergeMemory(v.mem, stored, false) : v.mem, next, /opus/i.test(model), now)
    events = r.events
    return { ...next, hasData: true, mem: r.mem }
  })
  // The stored bust belongs to whoever began or ended it: a session that only took a
  // reading leaves it alone, so it neither wipes another session's bust nor revives one.
  const owns = !stored || events.some(ev => ev.type === 'busted' || ev.type === 'released')
  await saveWanted($, owns ? after.mem : { ...after.mem, busted: stored.busted ?? null, bustedKey: stored.bustedKey ?? after.mem.bustedKey })
  await announce($, events)
  scheduleReset($, next, now)
}

/** The wanted memory lives in $.store too: it outlasts /clear and is shared by every open session. */
async function saveWanted($: EngineInterface, mem: WantedMemory): Promise<void> {
  try {
    await $.store.set(WANTED_KEY, mem)
  } catch {
    // the store is full; the memory still works for this session
  }
}

async function storedWanted($: EngineInterface): Promise<Partial<WantedMemory> | null> {
  try {
    const v = await $.store.get(WANTED_KEY)
    return v && typeof v === 'object' ? (v as Partial<WantedMemory>) : null
  } catch {
    return null
  }
}

/** At session start (and after /clear) the stored memory comes back, a bust in force included. */
async function loadWanted($: EngineInterface): Promise<void> {
  const v = await storedWanted($)
  if (!v) return
  // A bust whose reset time has passed is over: a new session does not wear it.
  const isOver = !!v.busted && v.busted.until !== null && v.busted.until <= (await $.clock.now())
  const stored = isOver ? { ...v, busted: null } : v
  const after = await update($, limits, (cur): LimitsState => ({ ...cur, mem: { ...mergeMemory(cur.mem, stored, true), healthWarned: false } }))
  if (isOver) await saveWanted($, after.mem)
}

/** The engine fires nothing when a window resets, so the mod sets its own alarm. */
/** One alarm at a time, set without awaiting so a later call always cancels an earlier one. */
function scheduleReset($: EngineInterface, l: Limits, now: number): void {
  resetTimer?.cancel()
  resetTimer = null
  const times = [l.short, l.week, l.spend].map(w => w?.resetsAt ?? null).filter((t): t is number => t !== null)
  if (!times.length) return
  const wait = Math.max(5_000, Math.min(...times) - now + 3_000)
  if (wait > 8 * 86_400_000) return
  resetTimer = $.clock.after(wait, () => {
    if (isFull && !isOff) void refreshUsage($, false).catch(() => undefined)
  })
}

async function announce($: EngineInterface, events: readonly WantedEvent[]): Promise<void> {
  if (!events.length) return
  const s = await snapshot($)
  const lang = s.env.lang
  const W = LABELS[lang].wanted
  const when = (at: number | null) => (at === null ? null : fmtResetAt(at, s.nowMs, s.env.offset, lang))
  for (const ev of events) {
    if (ev.type === 'stars') {
      if (ev.stars > s.records.maxStars) await bumpRecords($, r => ({ ...r, maxStars: Math.max(r.maxStars, ev.stars) }))
      // One star is a note in the HUD, not news: the toasts start at two.
      if (opts.wanted && ev.stars >= 2) {
        $.ui.toast(W.starToast(starsText(ev.stars), W.levels[ev.stars - 1] ?? '', `${Math.round(ev.pct)}%`, when(ev.resetsAt)), { timeoutMs: 8000 })
        if (ev.stars >= 3) await flashLights($)
        if (ev.stars >= 4) await sfx($, 'siren')
      }
    } else if (ev.type === 'escape') {
      // Every open session sees the same window end: count it once.
      await bumpRecords($, r => (r.escapedKey === ev.key ? r : { ...r, escapes: r.escapes + 1, escapedKey: ev.key }))
      if (opts.wanted) $.ui.toast(W.escape, { timeoutMs: 8000 })
    } else if (ev.type === 'busted') {
      await update($, live, v => (v ? { ...v, busts: (v.busts ?? 0) + 1 } : v))
      await bumpRecords($, r => ({ ...r, maxStars: Math.max(r.maxStars, 5) }))
      if (opts.wanted) {
        await placeBusted($)
        await flashLights($)
        await sfx($, 'siren')
      }
    } else if (ev.type === 'released') {
      if (opts.wanted) $.ui.toast(W.released, { timeoutMs: 8000 })
    } else if (ev.type === 'armor') {
      if (opts.wanted) $.ui.toast(W.armor(ev.level, `${Math.round(ev.left)}%`, when(ev.resetsAt), ev.kind), { timeoutMs: 8000 })
    } else if (ev.type === 'swapRide') {
      if (opts.wanted) $.ui.toast(W.swapRide, { timeoutMs: 8000 })
    }
  }
}

/** A short sound effect, only when sounds are on; never in the way if there is no player. */
async function sfx($: EngineInterface, name: 'siren' | 'medkit'): Promise<void> {
  if (!opts.sounds) return
  void $.audio.play({ base64: sound(name), mime: 'audio/wav' }, { gain: opts.radioVolume }).catch(() => undefined)
}

/** A compaction is a medkit: count it, say it, and refresh health. */
async function medkit($: EngineInterface, trigger: 'manual' | 'auto' | 'plugin', before: number | null, after: number | null): Promise<void> {
  const saved = before !== null && after !== null ? Math.max(0, before - after) : 0
  await update($, live, v => (v ? { ...v, medkits: (v.medkits ?? 0) + 1, medkitTokens: (v.medkitTokens ?? 0) + saved } : v))
  await update($, hud, (v): Hud => ({ ...v, contextTokens: after ?? null, contextPct: null }))
  await update($, limits, (v): LimitsState => ({ ...v, mem: { ...v.mem, healthWarned: false } }))
  const lang = (await read($, env)).lang
  if (opts.wanted && before !== null && after !== null) {
    const W = LABELS[lang].wanted
    const b = fmtCompact(before, lang)
    const a = fmtCompact(after, lang)
    // Your own /compact or another mod's is a medkit; only the engine's auto-compact is the paramedics.
    $.ui.toast(trigger === 'auto' ? W.medkitAuto(b, a) : W.medkitManual(b, a), { timeoutMs: 6000 })
  }
  await sfx($, 'medkit')
}

async function currentCost($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

/** A new conversation in the same process (/clear, /resume): new card, new counters. */
async function resetConversation($: EngineInterface): Promise<void> {
  await update($, live, () => null)
  await update($, hud, (v): Hud => ({ ...v, contextPct: null, contextTokens: null, costUsd: null }))
  await update($, limits, (v): LimitsState => ({ ...v, mem: { ...v.mem, healthWarned: false } }))
  await update($, counters, (): Counters => ({ mainTurns: 0, costBaseline: null }))
}

async function playLoop($: EngineInterface, stop: AbortController): Promise<void> {
  for (;;) {
    const started = await $.clock.now()
    try {
      await $.audio.play(
        { base64: sound('radio'), mime: 'audio/wav' },
        { shouldLoop: true, gain: opts.radioVolume, signal: stop.signal },
      )
    } catch {
      // Refused or not decodable here: say so instead of flipping the button back in silence.
      if (!stop.signal.aborted && radioStop === stop) $.ui.toast(LABELS[(await read($, env)).lang].command.radioNoPlayer)
      break
    }
    if (stop.signal.aborted || radioStop !== stop) return
    // A loop plays until the engine ends it; one that ends at once means there is no player here.
    if ((await $.clock.now()) - started < 5_000) {
      $.ui.toast(LABELS[(await read($, env)).lang].command.radioNoPlayer)
      break
    }
  }
  if (radioStop === stop) radioStop = null
  try {
    await update($, radio, v => ({ ...v, playing: false }))
  } catch {
    // the module was unloaded while the clip played
  }
}

async function toggleRadio($: EngineInterface): Promise<boolean> {
  const r = await read($, radio)
  if (r.playing || radioStop) {
    radioStop?.abort()
    radioStop = null
    await update($, radio, v => ({ ...v, playing: false }))
    return false
  }
  const stop = new AbortController()
  radioStop = stop
  await update($, radio, v => ({ ...v, playing: true }))
  void playLoop($, stop)
  return true
}

async function openStats($: EngineInterface): Promise<string> {
  const L = LABELS[(await read($, env)).lang]
  const r = await $.ui.open({ id: PANE, title: 'Vice Code', columns: 46, focus: true })
  return r.isPlaced ? L.command.statsOpened : L.command.statsNotPlaced(r.reason)
}

/**
 * Sets the mod up once somebody is watching: at the start under the terminal, at the
 * first window in a session a program started. Nothing here may keep /vice from existing.
 */
async function wake($: EngineInterface): Promise<void> {
  phase = 'awake'
  try {
    if (isTooOld((await $.session.version()).base)) {
      inert = true
      $.ui.toast(LABELS[(await read($, env)).lang].needsUpdate, { timeoutMs: 15_000 })
      return
    }
  } catch {
    // an engine that cannot say its version is new enough to try
  }
  await loadChoices($)
  // The command and the timers first. A mod that is off keeps its command, so /vice on can bring it back.
  const L = LABELS[(await read($, env)).lang]
  await $.command
    .register({ name: 'vice', description: L.command.description, argumentHint: L.command.hint })
    .catch(err => $.ui.log(`vice-code: /vice was not registered: ${String(err)}`))
  $.clock.every(30_000, () => {
    if (isOff) return
    if (isFull) void update($, tick, n => n + 1)
    // The scene follows the hour: dawn, day, sunset, night.
    void syncScene($).catch(() => undefined)
  })
  try {
    // A hot reload drops the module's handles but keeps $.state: bring the two back in line.
    if (!radioStop && (await read($, radio)).playing) await update($, radio, v => ({ ...v, playing: false }))
    if (!isImporting && (await read($, importing)).active) await update($, importing, v => ({ ...v, active: false }))
    if (isFull && !isOff) scheduleImport($)
    await startSession($, false)
    const lang = (await read($, env)).lang
    if (LABELS[lang] !== L) {
      // Registering the same name again replaces the description with the detected language.
      await $.command
        .register({ name: 'vice', description: LABELS[lang].command.description, argumentHint: LABELS[lang].command.hint })
        .catch(() => undefined)
    }
    if (isFull && !isOff) await sayLegend($)
  } catch (err) {
    $.ui.log(`vice-code: session setup failed: ${String(err).slice(0, 200)}`)
  }
}

export const register: Register = (on, options) => {
  opts = readOptions(options)

  // ---------- lifecycle ----------

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    phase = 'starting'
    inert = false
    // A session a program started (claude -p, an SDK script, and the desktop and mobile
    // apps, which drive the engine the same way) has nobody at it until a window
    // attaches. A script never gets one, so the mod stays out of it for good; an app's
    // window wakes the mod, at once if it is here already.
    if (e.isInteractive === false) {
      let isWatched = false
      try {
        isWatched = (await $.session.surfaces()).length > 0
      } catch {
        // an engine without the roster: wait for session.attach
      }
      // `phase` is 'awake' if a window attached while the roster was being read.
      if (!isWatched && phase === 'starting') {
        phase = 'dormant'
        inert = true
        return result
      }
    }
    await wake($)
    return result
  })

  // /clear, /resume and /branch start another conversation and reset $.state: set it up again.
  on('classic.SessionStart', async ($, e, next) => {
    if (inert || isOff) return next(e)
    const result = await next(e)
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      try {
        await startSession($, true)
      } catch (err) {
        $.ui.log(`vice-code: session setup failed: ${String(err).slice(0, 200)}`)
      }
    }
    return result
  }).catch(($, e, next) => next(e))

  // A window that attaches after the session began gets the look, and Lite's first card, then.
  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    // The first window of a session a program started: somebody is watching now.
    if (phase !== 'awake') {
      const wasDormant = phase === 'dormant'
      phase = 'awake'
      if (wasDormant) {
        inert = false
        await wake($)
      }
      return result
    }
    // Another window, or one that came after the start: it gets the look, and Lite's first card.
    if (inert || isOff || (isBackdropDrawn && !isGreetingPending)) return result
    try {
      await applyLook($)
      if (isGreetingPending && !isFull) {
        isGreetingPending = false
        await greetLite($, false)
      }
    } catch (err) {
      $.ui.log(`vice-code: the look was not set on attach: ${String(err).slice(0, 200)}`)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    if (inert || isOff || !isFull) return next(e)
    // /clear and /resume switch conversations without a session.start.
    if (e.reason === 'clear' || e.reason === 'resume') await resetConversation($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (phase === 'dormant') await wakeIfWatched($).catch(() => undefined)
    if (inert || isOff) return next(e)
    const result = await next(e)
    // The desktop app sends what the person typed through the SDK; runs nobody watches are inert already.
    const isPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge' || e.origin.kind === 'sdk'
    if (!isPerson || e.isMeta) return result
    if (isFull) {
      const lv = await read($, live)
      if (!lv || lv.sessionId !== (await $.session.id())) await startFull($, true)
    }
    const hasCyrillic = /[Ѐ-ӿ]/.test(e.text)
    if (!e.command) {
      if (isFull) await update($, live, v => (v ? { ...v, prompts: v.prompts + 1, hasCyrillic: v.hasCyrillic || hasCyrillic } : v))
      if (opts.language === 'auto' && hasCyrillic && (await read($, env)).lang !== 'ru') {
        await update($, env, (v): Env => ({ ...v, lang: 'ru' }))
      }
      // Lite reads no history, so the language of the prompts is all it goes by. It is kept
      // for next time once it is a habit: two prompts in Cyrillic, or five without any.
      if (opts.language === 'auto') {
        if (hasCyrillic) seenRu += 1
        else seenOther += 1
        if (hasCyrillic && seenRu === 2) await safeSet($, LANG_KEY, 'ru')
        else if (!hasCyrillic && seenRu === 0 && seenOther === 5 && (await seenLang($)) === 'ru') await safeSet($, LANG_KEY, 'en')
      }
    }
    return result
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (inert || isOff) return next(e)
    if (e.agentId === undefined) {
      // A window that had not attached when the session began draws the look from its first turn.
      if (isBackdropPending && !hasRetriedLook) {
        hasRetriedLook = true
        isBackdropPending = false
        const isLate = isGreetingPending && !isFull
        isGreetingPending = false
        void applyLook($)
          .then(() => (isLate ? greetLite($, false, true) : undefined))
          .catch(() => undefined)
      }
      if (isFull) {
        turnErrors = 0
        turnStartedAt = await $.clock.now()
        await update($, seed, () => Math.floor(Math.random() * 1_000_000))
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (inert || isOff || !isFull) return next(e)
    const result = await next(e)
    const usage = e.usage
    const isMain = e.agentId === undefined
    await update($, live, (v): Live | null => {
      if (!v) return v
      const models = { ...v.models }
      if (usage) {
        const fam = modelFamily(usage.model)
        models[fam] = (models[fam] ?? 0) + 1
      }
      return {
        ...v,
        turns: v.turns + (isMain ? 1 : 0),
        activeMs: v.activeMs + (isMain ? Math.max(0, e.durationMs) : 0),
        tokensIn: v.tokensIn + (usage ? usage.input_tokens + usage.cache_creation_input_tokens : 0),
        tokensOut: v.tokensOut + (usage ? usage.output_tokens : 0),
        cacheRead: v.cacheRead + (usage ? usage.cache_read_input_tokens : 0),
        models,
      }
    })
    if (isMain && e.reason === 'answer') {
      // An answer to a turn that began after the bust: the limit is not blocking (extra usage, or a reset).
      const lim = await read($, limits)
      const b = lim.mem.busted
      if (b && (b.since ?? 0) < turnStartedAt) {
        const overage = b.sticky ? [] : fullKeys(lim)
        const after = await update($, limits, (v): LimitsState => ({ ...v, mem: { ...v.mem, busted: null, free: [...new Set([...(v.mem.free ?? []), ...overage])] } }))
        await saveWanted($, after.mem)
        // A window that keeps answering past 100% was never a bust: take it back.
        if (overage.length) await update($, live, v => (v ? { ...v, busts: Math.max(0, (v.busts ?? 0) - 1) } : v))
        if (opts.wanted) {
          const W = LABELS[(await read($, env)).lang].wanted
          $.ui.toast(overage.length ? W.overage : W.released, { timeoutMs: 8000 })
        }
      }
      const c = await update($, counters, (v): Counters => ({ ...v, mainTurns: v.mainTurns + 1 }))
      // Street talk cheers a clean job, so a turn with a failed tool call gets none.
      const now = await $.clock.now()
      if (opts.toasts && turnErrors === 0 && c.mainTurns % opts.toastEvery === 0 && now - (c.lastTalkAt ?? 0) >= TALK_GAP_MS) {
        const lang = (await read($, env)).lang
        const line = pick(TOASTS[lang], hash(`${e.turnId}`))
        if (line) $.ui.toast(line)
        await update($, counters, (v): Counters => ({ ...v, lastTalkAt: now }))
      }
    }
    return result
  })

  // A turn that died on an API error: a rate limit is a bust, an outage a stalled ride.
  on('classic.StopFailure', async ($, e, next) => {
    if (inert || isOff || !isFull) return next(e)
    const result = await next(e)
    try {
      if (e.error === 'rate_limit') {
        await refreshUsage($, false)
        const now = await $.clock.now()
        let fresh: { kind: BustKind; until: number | null } | null = null
        // A window the mod can see explains it, or a hidden one does (a model's weekly cap, overage).
        const after = await update($, limits, (v): LimitsState => {
          fresh = null
          if (v.mem.busted) return v
          fresh = rejectedBy(v)
          return { ...v, mem: { ...v.mem, busted: { ...fresh, sticky: true, since: now }, bustedKey: windowKey(v.short) } }
        })
        const bust = fresh as { kind: BustKind; until: number | null } | null
        if (bust) {
          await saveWanted($, after.mem)
          await announce($, [{ type: 'busted', kind: bust.kind, until: bust.until }])
          scheduleReset($, after, now)
        }
      } else if ((e.error === 'overloaded' || e.error === 'server_error') && e.agent_id === undefined) {
        await update($, live, v => (v ? { ...v, stalls: (v.stalls ?? 0) + 1 } : v))
        if (opts.toasts) $.ui.toast(LABELS[(await read($, env)).lang].wanted.stall)
      }
    } catch {
      // the rap sheet is a nicety: never get in the way of the error itself
    }
    return result
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    if (inert || isOff || !isFull) return next(e)
    const result = await next(e)
    if (e.trigger !== 'precompute' && e.agentId === undefined && !('skip' in result)) {
      await medkit($, e.trigger, result.tokensBefore ?? null, result.tokensAfter ?? null)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    if (inert || isOff || !isFull) return next(e)
    // A new model can bring another context window and auto-compact threshold.
    if (e.changed.includes('context') && e.context.window !== (await read($, hud)).window) await refreshUsage($, true)
    await applyUsage($, e.context.percent ?? null, e.context.tokens ?? null, e.cost?.usd)
    if (e.changed.includes('rateLimits')) await applyLimits($, e.rateLimits)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (inert || isOff || !isFull) return next(e)
    const tool = toolBucket(String(e.tool))
    await update($, live, v => (v ? { ...v, tools: { ...v.tools, [tool]: (v.tools[tool] ?? 0) + 1 } } : v))
    const result = await next(e)
    if (result.isError === true && e.agentId === undefined) turnErrors += 1
    if ((e.tool === 'Edit' || e.tool === 'Write') && result.deny === undefined && result.isError !== true) {
      let lines = patchLines(result.result)
      // A new file comes back with an empty patch: count its lines from the input.
      if (e.tool === 'Write' && !lines.added && !lines.removed && (result.result as { type?: unknown } | undefined)?.type === 'create') {
        lines = { added: e.content.split('\n').length, removed: 0 }
      }
      if (lines.added || lines.removed) {
        await update($, live, v => (v ? { ...v, added: v.added + lines.added, removed: v.removed + lines.removed } : v))
      }
    }
    return result
  }).catch(($, e, next) => next(e))

  // ---------- commands ----------

  on('command.run', { command: 'vice' }, async ($, e) => {
    const L = LABELS[(await read($, env)).lang]
    const words = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const sub = words[0] ?? ''
    if (sub === 'on') {
      if (!isOff) return { text: L.command.alreadyOn }
      await turnOn($)
      return { text: L.command.turnedOn }
    }
    if (isOff) return { text: L.command.isOff }
    if (sub === 'off') {
      await turnOff($)
      return { text: L.command.turnedOff }
    }
    if (sub === 'full' || sub === 'game') {
      if (isFull) return { text: L.command.alreadyFull }
      await enterFull($)
      return { text: L.command.modeFull }
    }
    if (sub === 'lite') {
      if (!isFull) return { text: L.command.alreadyLite }
      await enterLite($)
      return { text: L.command.modeLite }
    }
    if (sub === 'paper') {
      const p = words[1]
      if (p !== 'light' && p !== 'dark' && p !== 'auto') return { text: L.command.paperHelp }
      paper = p
      await choose<Stock>($, PAPER_KEY, p, opts.paper)
      await syncScene($)
      await applyLook($)
      return { text: L.command.paperSet[p] }
    }
    if (sub === 'card') {
      await placeWelcome($, isFull ? WELCOME : HELLO)
      return { text: L.command.cardShown }
    }
    if (sub === 'backdrop') {
      const isOn = !(await isBackdropOn($))
      await choose($, BACKDROP_KEY, isOn, opts.backdrop)
      if (!isOn) {
        // Asked for by the person, so clearing the session's one theme is theirs to decide.
        // Cleared first: an engine from before the colors would otherwise keep the scene.
        await $.theme.clear().catch(() => undefined)
        // Then the look again, which is now the colors alone.
        await applyLook($)
        return { text: L.command.backdropOff }
      }
      const why = await applyLook($)
      return { text: why === null ? L.command.backdropOn : L.command.backdropNone(why) }
    }
    if (sub === 'radio') return { text: (await toggleRadio($)) ? L.command.radioOn : L.command.radioOff }
    // What is left belongs to the game.
    if (!isFull) return { text: sub === '' || sub === 'help' ? L.command.helpLite : L.command.gameOnly }
    if (sub === '' || sub === 'stats') return { text: await openStats($) }
    if (sub === 'wanted' || sub === 'rap') {
      await update($, ui, (v): UiState => ({ ...v, tab: 'rap' }))
      return { text: await openStats($) }
    }
    if (sub === 'tip') {
      const v = await update($, ui, u => ({ ...u, tipShift: u.tipShift + 1 }))
      const s = await snapshot($)
      return { text: `${L.tip}: ${tipFor(s.env.lang, liveDay(s.live, s.nowMs, s.env.offset), v.tipShift)}` }
    }
    if (sub === 'import') {
      if (!opts.importHistory) return { text: L.command.importOff }
      const isWhole = words[1] === 'full'
      importTimer?.cancel()
      importTimer = $.clock.after(0, () => {
        void runImport($, isWhole).catch(() => undefined)
      })
      return { text: isWhole ? L.command.importStartedFull : L.command.importStarted }
    }
    return { text: L.command.help }
  })

  // ---------- drawing ----------
  // Words and numbers are the surface's own Text, in its sizes and theme colors, so the
  // mod follows the person's theme, light or dark. An SVG is only ever a picture or a meter.

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (inert || isOff || !isFull || !opts.spinner || e.props.message !== null) return next(e)
    // The desktop spinner names the step it is on ("Creating notes.md"): keep that, fill only "Working".
    if (e.surface === 'desktop' && e.props.word !== 'Working') return next(e)
    const lang = (await read($, env)).lang
    const stars = opts.wanted ? starsFor((await read($, limits)).short?.pct ?? null) : 0
    const word = spinnerWord(lang, e.props.mode, await read($, seed), stars)
    return next({ ...e, props: { ...e.props, word } })
  })

  // The prompt footer's mode labels: the wanted level stays in sight even with the band folded.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    // The 30-second tick keeps the countdown moving while you wait; nothing else here re-draws it.
    await read($, tick)
    if (inert || isOff || !isFull || !opts.wanted) return next(e)
    const label = wantedLabel({ env: await read($, env), limits: await read($, limits), nowMs: await $.clock.now() })
    if (!label) return next(e)
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, label] } })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (inert || isOff || !isFull || !opts.weapons || e.props.isExpanded === true) return next(e)
    const engine = await next(e)
    const lang = (await read($, env)).lang
    const gear = weaponFor(e.props.tool.startsWith('mcp__') ? 'MCP' : e.props.tool, lang)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        <Text color="warning" size="caption" weight="semibold" mono>{gear}</Text>
        {engine}
      </Box>
    )
  })

  // The band above the prompt: one quiet line of meters, like a status line.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The tick is read first, so turning the game on or off redraws the band.
    await read($, tick)
    if (inert || isOff || !isFull || e.props.hasSurvey) return next(e)
    // The band is shared by every mod: draw ours and keep whatever the others draw below it.
    const others = await next(e)
    const s = await snapshot($)
    const L = LABELS[s.env.lang]
    const busted = opts.wanted ? bustedData(s) : null
    // With the HUD off the band stays empty, except while busted: that line says why Claude is quiet.
    if (opts.hud === 'off' && !busted) return others
    const hd = hudData(s, opts.showCost, opts.wanted)
    const isCompact = opts.hud === 'compact'
    // Compact is the wanted level alone: an account without usage windows has nothing to show.
    if (isCompact && hd.wanted === null && !busted) return others
    const stars = hd.wanted?.stars ?? 0
    const starsMode = hd.wanted?.blink ? 'fade' : s.nowMs < (s.ui.flashUntil ?? 0) ? 'flash' : 'still'
    const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`)

    if (e.surface === 'desktop') {
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      if (busted) {
        return (
          <Box flexDirection="column" gap="xs">
            <Box flexDirection="row" alignItems="center" columnGap="md" rowGap="xs" flexWrap="wrap">
              <Text size="footnote" weight="semibold" color="error">{L.wanted.bustedShort}</Text>
              <Text size="footnote">{busted.why}</Text>
              <Text size="footnote" weight="medium" color="warning">{busted.until}</Text>
              <Button key="stats" label={L.buttons.stats} variant="secondary" onPress={() => void openStats($).catch(() => undefined)} />
              <Button key="radio" label={s.radio.playing ? L.buttons.radioOff : L.buttons.radioOn} variant="secondary" onPress={() => void toggleRadio($).catch(() => undefined)} />
            </Box>
            {others}
          </Box>
        )
      }
      const meter = (key: string, label: string, value: number | null, none: string) => (
        <Box key={key} flexDirection="row" alignItems="center" gap="sm">
          <Text size="footnote" dimColor>{label}</Text>
          {value === null ? <Text size="footnote" dimColor>{none}</Text> : <Svg source={meterSvg(value)} alt={pct(value)} />}
          {value !== null && <Text size="footnote" tabular>{pct(value)}</Text>}
        </Box>
      )
      return (
        <Box flexDirection="column" gap="xs">
          <Box flexDirection="row" alignItems="center" columnGap="lg" rowGap="xs" flexWrap="wrap">
            {hd.wanted !== null && (
              <Box key="wanted" flexDirection="row" alignItems="center" gap="sm">
                <Text size="footnote" dimColor>{hd.wanted.label}</Text>
                <Svg source={starsSvg(stars, starsMode)} alt={stars > 0 ? starsText(stars) : hd.wanted.clean} isInteractive />
                {hd.wanted.reset !== null && stars > 0 && (
                  <Text size="footnote" weight="medium" {...(stars >= 3 ? { color: 'warning' } : {})}>{hd.wanted.reset}</Text>
                )}
              </Box>
            )}
            {!isCompact && meter('health', hd.healthLabel, hd.health, '—')}
            {!isCompact && hd.showArmor && meter('armor', hd.armorLabel, hd.armor, hd.noLimit)}
            {!isCompact && hd.money !== null && <Text size="footnote" dimColor tabular>{hd.money}</Text>}
            {!isCompact && hd.radio.isOn && <Text size="footnote" dimColor>{`♪ ${hd.radio.track}`}</Text>}
          </Box>
          {others}
        </Box>
      )
    }

    if (e.surface === 'terminal') {
      const { Box, Button, Text } = $.ui.resolve(e)
      const cols = e.props.bodyColumns
      if (busted) {
        return (
          <Box flexDirection="column">
            <Text wrap="truncate">
              <Text color="error" bold>{L.wanted.bustedShort}</Text>
              <Text dimColor>{' · '}</Text>
              <Text>{busted.why}</Text>
              <Text dimColor>{' · '}</Text>
              <Text color="warning">{busted.until}</Text>
            </Text>
            <Box flexDirection="row" gap={1}>
              <Button key="stats" label={L.buttons.stats} hotkey="s" onPress={() => void openStats($).catch(() => undefined)} />
              <Button key="radio" label={s.radio.playing ? L.buttons.radioOff : L.buttons.radioOn} hotkey="r" onPress={() => void toggleRadio($).catch(() => undefined)} />
            </Box>
            {others}
          </Box>
        )
      }
      const barW = cols >= 110 ? 10 : 6
      // What matters most stands first: a narrow terminal cuts the line from the right.
      return (
        <Box flexDirection="column">
          <Text wrap="truncate">
            {hd.wanted !== null && <Text color={stars >= 3 ? 'error' : stars > 0 ? 'warning' : 'subtle'}>{`${starsText(stars)} `}</Text>}
            {hd.wanted !== null && <Text dimColor>{`${stars > 0 && hd.wanted.reset !== null ? hd.wanted.reset : hd.wanted.clean}  `}</Text>}
            {!isCompact && <Text dimColor>{`${hd.healthLabel} `}</Text>}
            {!isCompact && <Text color={TONE_KEY[toneFor(hd.health)]}>{hd.health === null ? '—' : textBar(hd.health / 100, barW)}</Text>}
            {!isCompact && <Text>{hd.health === null ? '  ' : ` ${pct(hd.health)}  `}</Text>}
            {!isCompact && hd.showArmor && <Text dimColor>{`${hd.armorLabel} `}</Text>}
            {!isCompact && hd.showArmor && <Text color={TONE_KEY[toneFor(hd.armor)]}>{hd.armor !== null ? textBar(hd.armor / 100, barW) : hd.noLimit}</Text>}
            {!isCompact && hd.showArmor && <Text>{hd.armor === null ? '  ' : ` ${pct(hd.armor)}  `}</Text>}
            {!isCompact && hd.money !== null && <Text dimColor>{`${hd.money}  `}</Text>}
            {!isCompact && hd.radio.isOn && <Text dimColor>{`♪ ${hd.radio.track}`}</Text>}
          </Text>
          {others}
        </Box>
      )
    }

    return others
  })

  // Rows in the conversation: the welcome card at the start, and a busted card where
  // Claude went quiet. They sit where the engine's own notices do and scroll away with them.
  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (inert || isOff || e.props.plugin !== 'vice-code') return next(e)
    const id = e.props.id
    const isWelcome = id.startsWith(WELCOME)
    const isHello = id.startsWith(HELLO)
    if (!isWelcome && !isHello && !id.startsWith(BUSTED)) return next(e)
    // Read so the cards follow the scene: a banner of their own only where none stands behind them.
    const sc = await read($, scene)

    if (isHello) {
      const en = await read($, env)
      const L = LABELS[en.lang]
      const d = liteCardData(en, await $.clock.now())
      const isPlaying = (await read($, radio)).playing
      if (e.surface === 'terminal') {
        const { Box, Raster, Text } = $.ui.resolve(e)
        const cols = e.viewport?.columns ?? 80
        const sceneCols = cols >= 64 ? Math.min(34, Math.floor(cols * 0.4)) : 0
        const body = wrap(d.bodyPlain, Math.max(20, cols - sceneCols - 4), 3)
        const rows = 3 + body.length + (d.news ? 1 : 0)
        return (
          <Box flexDirection="row" gap={2}>
            {sceneCols > 0 && <Raster key="scene" columns={sceneCols} rows={rows} cells={sceneCells(d.tod, sceneCols, rows)} />}
            <Box flexDirection="column">
              <Text>
                <Text color="claude" bold>Vice Code</Text>
                <Text dimColor>{` · ${d.forLine}`}</Text>
              </Text>
              <Text bold>{d.title}</Text>
              {d.news && (
                <Text>
                  <Text dimColor>{d.news.before}</Text>
                  <Text color="claude">{d.news.strong}</Text>
                  <Text dimColor>{d.news.after}</Text>
                </Text>
              )}
              {body.map(line => (
                <Text dimColor>{line}</Text>
              ))}
              <Text color="subtle">{d.hintShort}</Text>
            </Box>
          </Box>
        )
      }
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" gap="sm" paddingY="sm">
          {/* The one picture that is sure to feel the pointer: a row's frame takes hover, the backdrop may not. */}
          <Svg isInteractive source={stripSvg(d.tod, sc.paper, 'vl')} alt={`${L.sceneAlt}, ${TOD_LABEL[en.lang][d.tod].toLowerCase()}`} />
          <Box flexDirection="column">
            <Text size="caption" dimColor>{`Vice Code · ${d.forLine}`}</Text>
            <Text size="title" weight="semibold">{d.title}</Text>
          </Box>
          <Text>{e.surface === 'desktop' || e.surface === 'mobile' ? (hasColors ? d.body : d.bodyScene) : d.bodyPlain}</Text>
          {d.news && (
            <Text size="footnote">
              <Text dimColor>{d.news.before}</Text>
              <Text weight="medium" color="claude">{d.news.strong}</Text>
              <Text dimColor>{d.news.after}</Text>
            </Text>
          )}
          <Box flexDirection="row" gap="sm" flexWrap="wrap" alignItems="center">
            {!isFull && <Button key="game" label={L.buttons.gameOn} variant="primary" onPress={() => void enterFull($).catch(() => undefined)} />}
            <Button key="radio" label={isPlaying ? L.buttons.radioOff : L.buttons.radioOn} variant="secondary" onPress={() => void toggleRadio($).catch(() => undefined)} />
            <Text size="caption" dimColor>{d.repo}</Text>
          </Box>
          <Text size="caption" dimColor>{d.hint}</Text>
        </Box>
      )
    }

    // The game's rows say nothing while the game is off.
    if (!isFull) return next(e)
    const s = await snapshot($)
    const L = LABELS[s.env.lang]

    if (isWelcome) {
      const d = cardData(s)
      if (e.surface === 'terminal') {
        const { Box, Raster, Text } = $.ui.resolve(e)
        const cols = e.viewport?.columns ?? 80
        const sceneCols = cols >= 72 ? Math.min(36, Math.floor(cols * 0.4)) : 0
        const tip = wrap(`${d.tipLabel} · ${d.tip}`, Math.max(20, cols - sceneCols - 4), 2)
        const rows = 6 + tip.length
        return (
          <Box flexDirection="row" gap={2}>
            {sceneCols > 0 && <Raster key="scene" columns={sceneCols} rows={rows} cells={sceneCells(d.tod, sceneCols, rows)} />}
            <Box flexDirection="column">
              <Text>
                <Text color="claude" bold>Vice Code</Text>
                <Text dimColor>{` · ${d.forLine}`}</Text>
              </Text>
              <Text bold>{d.greeting}</Text>
              <Text>
                <Text bold>{d.tiles[0]?.[0] ?? ''}</Text>
                <Text dimColor>{` ${d.tiles[0]?.[1] ?? ''} · `}</Text>
                <Text bold>{d.tiles[1]?.[0] ?? ''}</Text>
                <Text dimColor>{` ${d.tiles[1]?.[1] ?? ''}`}</Text>
              </Text>
              <Text>
                <Text bold>{d.tiles[2]?.[0] ?? ''}</Text>
                <Text dimColor>{` ${d.tiles[2]?.[1] ?? ''} · ${d.tiles[3]?.[1] ?? ''} `}</Text>
                <Text bold>{d.tiles[3]?.[0] ?? ''}</Text>
              </Text>
              <Text>
                <Text dimColor>{d.footer.before}</Text>
                <Text color="claude">{d.footer.strong}</Text>
                <Text dimColor>{d.footer.after}</Text>
              </Text>
              {tip.map(line => (
                <Text dimColor>{line}</Text>
              ))}
              <Text color="subtle">{L.welcomeHint}</Text>
            </Box>
          </Box>
        )
      }
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      // Where the scene already stands behind the conversation, the card is words alone.
      const hasScene = isBackdropDrawn && (e.surface === 'desktop' || e.surface === 'mobile')
      return (
        <Box flexDirection="column" gap="sm" paddingY="sm">
          {!hasScene && <Svg isInteractive source={stripSvg(d.tod, sc.paper, 'vw')} alt={`${L.sceneAlt}, ${TOD_LABEL[s.env.lang][d.tod].toLowerCase()}`} />}
          <Box flexDirection="column">
            <Text size="caption" dimColor>{`Vice Code · ${d.forLine}`}</Text>
            <Text size="title" weight="semibold">{d.greeting}</Text>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" columnGap="xl" rowGap="sm">
            {d.tiles.map(([value, label], i) => (
              <Box key={`tile-${i}`} flexDirection="column">
                <Text size="heading" weight="semibold" tabular>{value}</Text>
                <Text size="caption" dimColor>{label}</Text>
              </Box>
            ))}
          </Box>
          <Text size="footnote">
            <Text dimColor>{d.footer.before}</Text>
            <Text weight="medium" color="claude">{d.footer.strong}</Text>
            <Text dimColor>{d.footer.after}</Text>
          </Text>
          <Text size="footnote" dimColor>
            <Text weight="medium" color="claude">{d.tipLabel}</Text>
            {` · ${d.tip}`}
          </Text>
          <Box flexDirection="row" gap="sm" flexWrap="wrap" alignItems="center">
            <Button key="stats" label={L.buttons.stats} variant="secondary" onPress={() => void openStats($).catch(() => undefined)} />
            <Button key="radio" label={s.radio.playing ? L.buttons.radioOff : L.buttons.radioOn} variant="secondary" onPress={() => void toggleRadio($).catch(() => undefined)} />
            <Button key="tip" label={L.buttons.nextTip} variant="secondary" onPress={() => void update($, ui, v => ({ ...v, tipShift: v.tipShift + 1 }))} />
            <Text size="caption" dimColor>{d.repo}</Text>
          </Box>
        </Box>
      )
    }

    // A busted row whose bust is over stays in the conversation as one quiet line.
    const busted = opts.wanted ? bustedData(s) : null
    const isCurrent = busted !== null && id === bustedRowId(s.limits.mem.busted)
    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      if (!isCurrent || busted === null) return <Text dimColor>{L.wanted.releasedShort}</Text>
      return (
        <Box flexDirection="column">
          <Text>
            <Text color="error">{'▀▀▀▀▀▀▀▀'}</Text>
            <Text color="suggestion">{'▀▀▀▀▀▀▀▀'}</Text>
          </Text>
          <Text>
            <Text color="error" inverse bold>{` ${busted.title} `}</Text>
            <Text>{` ${busted.why}`}</Text>
          </Text>
          <Text color="warning" bold>{busted.until}</Text>
          <Text dimColor>{busted.pass}</Text>
        </Box>
      )
    }
    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    if (!isCurrent || busted === null) return <Text size="footnote" dimColor>{L.wanted.releasedShort}</Text>
    return (
      <Box flexDirection="column" gap="sm" paddingY="sm">
        <Svg isInteractive source={bustedSvg(busted.title, busted.repo, s.nowMs < (s.ui.flashUntil ?? 0))} alt={`${busted.title}. ${busted.why} ${busted.until}`} />
        <Box flexDirection="column">
          <Text size="heading" weight="semibold">{busted.why}</Text>
          <Text weight="medium" color="warning">{busted.until}</Text>
          <Text size="footnote" dimColor>{busted.pass}</Text>
        </Box>
        <Box flexDirection="row" gap="sm" flexWrap="wrap">
          <Button key="stats" label={L.buttons.stats} variant="secondary" onPress={() => void openStats($).catch(() => undefined)} />
          <Button key="radio" label={s.radio.playing ? L.buttons.radioOff : L.buttons.radioOn} variant="secondary" onPress={() => void toggleRadio($).catch(() => undefined)} />
        </Box>
      </Box>
    )
  })

  // The scene behind the conversation, where a surface draws backdrops. It is alive: the
  // sun's blind rolls, palms sway, and the wanted level brings patrol lights and a helicopter.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // The newest engines name the scene `scene`, the ones before them `id`.
    const props = e.props as { scene?: string; id?: string }
    const name = props.scene ?? props.id
    if (inert || isOff || e.props.plugin !== 'vice-code' || name !== BACKDROP) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)
    // The scene atom changes only with the hour, the paper or the mode, so the picture
    // is drawn again, and its motion restarted, only when it has to be.
    const sc = await read($, scene)
    const lang = (await read($, env)).lang
    let heat = 0
    let flash = false
    // The game brings the heat: patrol lights from three stars, a helicopter from four.
    if (sc.isFull && opts.wanted) {
      const lim = await read($, limits)
      heat = lim.mem.busted ? 5 : starsFor(lim.short?.pct ?? null)
      flash = (await $.clock.now()) < ((await read($, ui)).flashUntil ?? 0)
    }
    // Interactive, so the picture's own CSS animates it; reduced motion rests it. The desktop
    // app keeps the backdrop out of the pointer's reach (an inert layer under the
    // conversation), so the sky here moves by its own wave; the card's banner is the
    // picture that answers the pointer.
    return <Svg isInteractive source={backdropSvg(sc.tod, sc.paper, heat, flash)} alt={`${LABELS[lang].sceneAlt}, ${TOD_LABEL[lang][sc.tod].toLowerCase()}`} />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (inert || isOff) return next(e)
    await read($, tick)
    const s = await snapshot($)
    const L = LABELS[s.env.lang]
    const m = paneModel(s)
    const tod = timeOfDay(s.nowMs, s.env.offset)
    const setTab = (tab: Tab) => () => void update($, ui, (v): UiState => ({ ...v, tab }))

    if (e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile') {
      const { Box, Button, Link, Svg, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" gap="sm">
          <Svg isInteractive source={stripSvg(tod, paper, 'vp')} alt={`${L.sceneAlt}, ${TOD_LABEL[s.env.lang][tod].toLowerCase()}`} />
          <Box flexDirection="column">
            <Text size="caption" dimColor>Vice Code</Text>
            <Text size="heading" weight="semibold">{L.statsTitle}</Text>
          </Box>
          <Box flexDirection="row" gap="xs" flexWrap="wrap">
            {m.tabs.map(t => (
              <Button key={`tab-${t.id}`} label={t.label} variant={t.id === m.tab ? 'primary' : 'secondary'} onPress={setTab(t.id)} />
            ))}
          </Box>
          {m.tab === 'map' && m.districts.length > 0 && (
            <Svg source={mapSvg(m.districts, m.current)} alt={m.rows.map(r => `${r.label}: ${r.value}`).join(', ')} />
          )}
          {m.empty !== null && <Text dimColor>{m.empty}</Text>}
          <Box flexDirection="column">
            {m.rows.map((r, i) => (
              <Box key={`row-${i}`} flexDirection="row" justifyContent="space-between" gap="md">
                <Text dimColor>{r.label}</Text>
                <Text weight="medium" tabular>{r.value}</Text>
              </Box>
            ))}
          </Box>
          {m.note !== null && <Text size="caption" dimColor>{m.note}</Text>}
          {m.importError !== null && <Text size="footnote" color="error">{m.importError}</Text>}
          {m.session.length > 0 && <Text size="caption" weight="semibold" color="claude">{L.rows.thisSession}</Text>}
          <Box flexDirection="column">
            {m.session.map((r, i) => (
              <Box key={`now-${i}`} flexDirection="row" justifyContent="space-between" gap="md">
                <Text dimColor>{r.label}</Text>
                <Text tabular>{r.value}</Text>
              </Box>
            ))}
          </Box>
          <Box flexDirection="row" gap="sm" flexWrap="wrap" alignItems="center">
            <Button key="radio" label={s.radio.playing ? L.buttons.radioOff : L.buttons.radioOn} variant="secondary" onPress={() => void toggleRadio($).catch(() => undefined)} />
            <Link href={opts.radioUrl || RADIO_STATION.url} label={L.buttons.ownRadio} />
          </Box>
        </Box>
      )
    }

    if (e.surface === 'terminal') {
      const { Box, Button, Text } = $.ui.resolve(e)
      const w = Math.max(24, e.props.bodyColumns)
      const barW = Math.max(4, Math.min(12, w - 34))
      // The label column fits the longest label, so long values (a reset countdown) keep their room.
      const shareW = (r: { share?: number }) => (r.share === undefined ? 0 : barW + 1)
      const labelW = Math.max(8, Math.min(w - 18, Math.max(0, ...m.rows.map(r => r.label.length + shareW(r))) + 2))
      return (
        <Box flexDirection="column">
          <Text>
            <Text color="claude" bold>{'Vice Code '}</Text>
            <Text bold>{L.statsTitle}</Text>
          </Text>
          <Box flexDirection="row" gap={1}>
            {m.tabs.map((t, i) => (
              <Button key={`tab-${t.id}`} label={t.id === m.tab ? `[${t.label}]` : t.label} hotkey={String(i + 1)} plain onPress={setTab(t.id)} />
            ))}
          </Box>
          {m.empty !== null && <Text dimColor>{m.empty}</Text>}
          {m.rows.map(r => (
            <Text wrap="truncate">
              <Text dimColor>{clip(r.label, Math.max(4, labelW - shareW(r) - 1)).padEnd(Math.max(4, labelW - shareW(r)), ' ')}</Text>
              {r.share !== undefined && <Text color="claude">{`${textBar(r.share, barW)} `}</Text>}
              <Text bold>{r.value}</Text>
            </Text>
          ))}
          {m.note !== null && <Text dimColor>{m.note}</Text>}
          {m.importError !== null && <Text color="error">{m.importError}</Text>}
          {m.session.length > 0 && <Text color="claude" bold>{L.rows.thisSession}</Text>}
          {m.session.map(r => (
            <Text wrap="truncate">
              <Text dimColor>{clip(r.label, w - 18).padEnd(Math.max(8, w - 18), ' ')}</Text>
              <Text>{r.value}</Text>
            </Text>
          ))}
        </Box>
      )
    }

    return next(e)
  })
}
