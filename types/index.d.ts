// Vice Code's $.state contract: the session values its drawings read.
// Persistent numbers live in $.store; these are the live, per-session copies.

export type Lang = 'ru' | 'en'
export type Tab = 'general' | 'rap' | 'arsenal' | 'rides' | 'map'

/** Counts keyed by a name: tool name, model family, project. */
export type Counter = Record<string, number>

export type DayStat = {
  /** Sessions that started this local day. */
  s: number
  /** Laundered tokens: fresh input + cache writes + output. */
  k: number
  /** Lines added. */
  a: number
}

/** Everything the history import knows, summed over all past sessions. */
export type Totals = {
  sessions: number
  prompts: number
  responses: number
  tokensIn: number
  tokensOut: number
  cacheRead: number
  costUsd: number
  /** Sessions whose transcript carried a cost record. */
  costSessions: number
  added: number
  removed: number
  activeMs: number
  longestMs: number
  nightSessions: number
  tools: Counter
  models: Counter
  projects: Record<string, { s: number; ms: number }>
  days: Record<string, DayStat>
  /** Earliest local day seen, "2026-03-03", or null with no history. */
  firstDay: string | null
  /** Share of prompts written in Cyrillic, 0..1; drives language "auto". */
  cyrillic: number
  /** Rap sheet from history: rate-limit busts, compactions, tokens they freed, API outages. */
  busts: number
  medkits: number
  medkitTokens: number
  stalls: number
}

/** This session, counted live by the hooks. */
export type Live = {
  sessionId: string
  project: string
  startedAt: number
  prompts: number
  turns: number
  tokensIn: number
  tokensOut: number
  cacheRead: number
  added: number
  removed: number
  activeMs: number
  tools: Counter
  models: Counter
  isNight: boolean
  hasCyrillic: boolean
  /** The history already holds this session: a --resume or --continue. */
  isResumed: boolean
  /** This session's rap sheet. */
  busts: number
  medkits: number
  medkitTokens: number
  stalls: number
}

export type Hud = {
  /** Context window used, 0..100, or null before the first response. */
  contextPct: number | null
  /** Tokens in the context now, and where auto-compact kicks in; health is measured against it. */
  contextTokens: number | null
  threshold: number | null
  /** The model's context window the threshold was read for; a new window means a new threshold. */
  window?: number | null
  costUsd: number | null
}

export type Importing = { active: boolean; done: number; total: number; lastError: string | null }

export type UiState = {
  tab: Tab
  /** Bumped by /vice tip to show the next tip. */
  tipShift: number
  /** Until when (epoch ms) the lights flash: a few seconds after a new wanted level or a bust. */
  flashUntil?: number
  /** The session Lite's card was already decided for, so a hot reload does not place another. */
  greeted?: string
}

/**
 * What the backdrop is drawn from. Written only when the picture must change (a new time
 * of day, another paper, the game on or off), so a still scene is not redrawn.
 */
export type SceneState = {
  tod: 'dawn' | 'day' | 'sunset' | 'night'
  /** The stock the scene prints on: `auto` follows the window. */
  paper: 'auto' | 'light' | 'dark'
  /** The game is on: the scene shows the wanted level. */
  isFull: boolean
  rev: number
}

export type Radio = { playing: boolean; track: number }

export type Env = {
  lang: Lang
  player: string
  /** Local UTC offset in minutes, east positive. */
  offset: number
}

export type BustKind = 'short' | 'week' | 'spend' | 'hidden'

/** One usage window: percent used (0..100) and its reset time in epoch ms. */
export type LimitWindow = { pct: number; resetsAt: number | null }

/** What the mod remembers about the limits between readings (see hooks/lib/wanted.ts). */
export type WantedMemory = {
  announced: Record<string, number>
  armorAnnounced: Record<string, number>
  peak: number
  peakKey: string
  /** The last few five-hour windows known to have ended: a stored copy of one is no longer current. */
  closed?: string[]
  /**
   * The bust in force. `sticky`: it came from a rejected request, not from a window at
   * 100%; `hidden`: no visible window explains it. `since`: when it began (epoch ms).
   */
  busted: { kind: BustKind; until: number | null; sticky?: boolean; since?: number } | null
  /** The five-hour window key in which a bust happened: waiting it out is no escape. */
  bustedKey?: string
  tipKey: string
  healthWarned: boolean
  /** Windows that kept answering past 100% (extra usage): not a bust while they last. */
  free: string[]
}

export type LimitsState = {
  /** Five-hour window: the wanted level. */
  short: LimitWindow | null
  /** Seven-day window: armor. */
  week: LimitWindow | null
  /** A gateway's spend limit: armor when there is no weekly window. */
  spend: LimitWindow | null
  /** A window was reported in this session: an empty list after that means they ended. */
  hasData: boolean
  mem: WantedMemory
}

/** Kept in $.store: what transcripts cannot tell. `escapedKey` stops two sessions counting one escape. */
export type Records = { escapes: number; maxStars: number; escapedKey?: string }

/** Counters that must survive a hot reload. */
/** `lastTalkAt`: when street talk last spoke (epoch ms), so it keeps its distance. */
export type Counters = { mainTurns: number; costBaseline: number | null; lastTalkAt?: number }

declare module 'claude-code' {
  interface PluginState {
    'vice-code': {
      totals: Totals | null
      live: Live | null
      hud: Hud
      importing: Importing
      ui: UiState
      radio: Radio
      env: Env
      /** Bumped every 30 s so the HUD clock and time-of-day palette move. */
      tick: number
      /** Re-rolled on each main-loop turn: picks the spinner phrases. */
      seed: number
      limits: LimitsState
      records: Records
      counters: Counters
      scene: SceneState
    }
  }
}
