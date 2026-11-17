// Local time helpers: time of day for the skin, day keys for streaks, the release countdown.
// Every function takes epoch milliseconds plus the local UTC offset in minutes (east positive),
// so the logic does not depend on the time zone the hooks runtime happens to run in.

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night'

/** The game the countdown points at. The one place its name is written. */
export const GAME_LABEL = 'GTA VI' // ip-allow

/** Release day: 19 November 2026, local midnight. */
export const RELEASE = { year: 2026, month: 11, day: 19 }

export function localOffsetMinutes(): number {
  try {
    const off = -new Date().getTimezoneOffset()
    return Number.isFinite(off) ? off : 0
  } catch {
    return 0
  }
}

/** Wall-clock parts of `ms` in the local zone. */
export function localParts(ms: number, offsetMin: number) {
  const d = new Date(ms + offsetMin * 60_000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  }
}

/** "2026-10-27" in the local zone. */
export function dayKey(ms: number, offsetMin: number): string {
  const p = localParts(ms, offsetMin)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Dawn 05–09, day 09–17, sunset 17–20, neon night 20–05. */
export function timeOfDay(ms: number, offsetMin: number): TimeOfDay {
  const h = localParts(ms, offsetMin).hours
  if (h >= 5 && h < 9) return 'dawn'
  if (h >= 9 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'sunset'
  return 'night'
}

/** Sessions that start between 00:00 and 05:00 count as night runs. */
export function isNightHour(ms: number, offsetMin: number): boolean {
  return localParts(ms, offsetMin).hours < 5
}

function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/** Whole local days until the release; 0 on release day, negative after. */
export function daysUntilRelease(ms: number, offsetMin: number): number {
  const p = localParts(ms, offsetMin)
  return dayNumber(RELEASE.year, RELEASE.month, RELEASE.day) - dayNumber(p.year, p.month, p.day)
}

/** Shifts a day key by `delta` days: shiftDay("2026-10-27", -1) → "2026-10-26". */
export function shiftDay(key: string, delta: number): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/**
 * Consecutive active days ending today (or yesterday, so a streak survives
 * until the first session of the day).
 */
export function streak(activeDays: readonly string[], today: string): number {
  const set = new Set(activeDays)
  let cursor = set.has(today) ? today : shiftDay(today, -1)
  let n = 0
  while (set.has(cursor)) {
    n += 1
    cursor = shiftDay(cursor, -1)
  }
  return n
}

/** Day keys of the last `n` days including today, newest first. */
export function lastDays(today: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(shiftDay(today, -i))
  return out
}
