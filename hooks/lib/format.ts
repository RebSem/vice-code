// Number, money and duration formatting for ru and en.
// The hooks module runs without Intl guarantees, so everything is done by hand.

export type Lang = 'ru' | 'en'

const NBSP = ' '
const MINUS = '−'

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0
}

/** 184220 → "184 220" (ru) / "184,220" (en). */
export function fmtInt(n: number, lang: Lang): string {
  const sign = safe(n) < 0 ? MINUS : ''
  const digits = String(Math.round(Math.abs(safe(n))))
  const sep = lang === 'ru' ? NBSP : ','
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

/** "+12 480" / "−3 115"; zero stays "0". */
export function fmtSigned(n: number, lang: Lang): string {
  const v = Math.round(safe(n))
  if (v === 0) return '0'
  return (v > 0 ? '+' : '') + fmtInt(v, lang)
}

function oneDecimal(n: number, lang: Lang): string {
  const s = (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return lang === 'ru' ? s.replace('.', ',') : s
}

/** 4_200_000 → "4,2 млн" / "4.2M"; below 10 000 prints the whole number. */
export function fmtCompact(n: number, lang: Lang): string {
  const v = Math.abs(safe(n))
  const sign = safe(n) < 0 ? MINUS : ''
  if (v < 10_000) return sign + fmtInt(v, lang)
  // Pick the unit after rounding to one decimal, so 999 950 reads 1M, not 1000K.
  if (v < 999_950) return sign + oneDecimal(v / 1000, lang) + (lang === 'ru' ? NBSP + 'тыс.' : 'K')
  if (v < 999_950_000) return sign + oneDecimal(v / 1_000_000, lang) + (lang === 'ru' ? NBSP + 'млн' : 'M')
  return sign + oneDecimal(v / 1_000_000_000, lang) + (lang === 'ru' ? NBSP + 'млрд' : 'B')
}

/** 3.4219 → "$3.42" (en) / "$3,42" (ru). */
export function fmtMoney(usd: number, lang: Lang): string {
  const v = Math.max(0, safe(usd))
  const whole = Math.floor(v)
  const cents = String(Math.round((v - whole) * 100)).padStart(2, '0')
  const fixedCents = cents === '100' ? '00' : cents
  const fixedWhole = cents === '100' ? whole + 1 : whole
  return '$' + fmtInt(fixedWhole, lang) + (lang === 'ru' ? ',' : '.') + fixedCents
}

/** 0.62 → "62%". */
export function fmtPct(ratio: number): string {
  return Math.round(Math.max(0, Math.min(1, safe(ratio))) * 100) + '%'
}

/** Russian plural: plural(5, ['день', 'дня', 'дней']) → 'дней'. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const a = Math.abs(Math.trunc(n)) % 10
  const b = Math.abs(Math.trunc(n)) % 100
  if (a === 1 && b !== 11) return forms[0]
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return forms[1]
  return forms[2]
}

/** "24 дня" / "24 days". */
export function fmtDays(n: number, lang: Lang): string {
  const v = Math.max(0, Math.trunc(safe(n)))
  if (lang === 'ru') return v + NBSP + pluralRu(v, ['день', 'дня', 'дней'])
  return v + NBSP + (v === 1 ? 'day' : 'days')
}

/** 11_532_000 ms → "3 ч 12 мин" / "3h 12m"; under an hour → "12 мин" / "12m". */
export function fmtDuration(ms: number, lang: Lang): string {
  const totalMin = Math.max(0, Math.round(safe(ms) / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (lang === 'ru') {
    if (h === 0) return m + NBSP + 'мин'
    return fmtInt(h, lang) + NBSP + 'ч' + (m ? ' ' + m + NBSP + 'мин' : '')
  }
  if (h === 0) return m + 'm'
  return fmtInt(h, lang) + 'h' + (m ? ' ' + m + 'm' : '')
}

/** Hours only, for big totals: "312 ч" / "312h". */
export function fmtHours(ms: number, lang: Lang): string {
  const h = Math.floor(Math.max(0, safe(ms)) / 3_600_000)
  return fmtInt(h, lang) + (lang === 'ru' ? NBSP + 'ч' : 'h')
}

/** "19:47". */
export function fmtClock(hours: number, minutes: number): string {
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
}

/** Keeps a text to one line of at most `max` characters. */
export function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : one.slice(0, Math.max(1, max - 1)) + '…'
}
