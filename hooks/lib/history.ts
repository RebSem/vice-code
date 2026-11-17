// Summarizing Claude Code transcripts (~/.claude/projects/<project>/<session>.jsonl).
// Big transcripts (100 MB+) go through awk in a child process; files up to 4 MiB
// can also be read by the module and parsed by summarizeText, which mirrors the awk.

/** One transcript, summed. Short keys keep $.store small. */
export type FileSummary = {
  /** First and last timestamp, epoch seconds. */
  t0: number
  t1: number
  /** Active seconds: gaps between consecutive entries under 15 minutes. */
  act: number
  /** API responses, deduplicated by message id. */
  n: number
  /** Prompts the person typed, and how many of them hold Cyrillic. */
  u: number
  cy: number
  i: number
  o: number
  cr: number
  cw: number
  /** 1 when the file carries a cost-state record (cost and line counts). */
  hc: number
  c: number
  a: number
  r: number
  cwd: string
  /** Responses per raw model id. */
  m: Record<string, number>
  /** Tool uses per tool name. */
  tl: Record<string, number>
  /**
   * Busts: rate-limit rejections, one key per window ("five_hour:<reset epoch>"), or
   * "t<epoch>" for old transcripts without quota details (merged within 15 minutes later).
   */
  bk: string[]
  /** Medkits: context compactions, automatic and manual, and the tokens they freed. */
  mka: number
  mkm: number
  mks: number
  /** Stalls: API outages (the first retry of each). */
  st: number
}

/**
 * A stored entry: the summary without the absolute cwd (only the project folder's
 * name is kept), plus the file identity it was made from. `sub` marks the summed
 * subagent transcripts of one session: they add tokens, responses, tools and models,
 * never sessions, prompts or time.
 */
export type StoredSummary = Omit<FileSummary, 'cwd'> & { p: string; size: number; mtime: number; sub?: 1 }

export function toStored(s: FileSummary, size: number, mtime: number, isSub: boolean): StoredSummary {
  const { cwd, ...rest } = s
  const out: StoredSummary = { ...rest, p: projectName(cwd), size, mtime }
  if (isSub) out.sub = 1
  return out
}

/**
 * POSIX awk (BSD awk on macOS, gawk, mawk). Run with LC_ALL=C and -v sid=<session id>.
 * Prints one JSON object, the FileSummary of the transcripts named as its arguments.
 * Lines stamped with another session id (a fork or continue copies its parent's lines)
 * are skipped; an empty sid keeps every line (subagent transcripts).
 */
export const AWK_PROGRAM = String.raw`
function str(s, key,   p, r) {
  p = "\"" key "\":\""
  r = index(s, p)
  if (r == 0) return ""
  s = substr(s, r + length(p))
  r = index(s, "\"")
  if (r == 0) return ""
  return substr(s, 1, r - 1)
}
function num(s, key,   p, r, t) {
  p = "\"" key "\":"
  r = index(s, p)
  if (r == 0) return 0
  t = substr(s, r + length(p), 32)
  if (match(t, /^-?[0-9.]+([eE][-+]?[0-9]+)?/)) return substr(t, 1, RLENGTH) + 0
  return 0
}
function epoch(ts,   y, mo, d, h, mi, se, era, yoe, doy, doe) {
  y = substr(ts, 1, 4) + 0; mo = substr(ts, 6, 2) + 0; d = substr(ts, 9, 2) + 0
  h = substr(ts, 12, 2) + 0; mi = substr(ts, 15, 2) + 0; se = substr(ts, 18, 2) + 0
  if (y < 1971) return 0
  if (mo <= 2) { y -= 1; mo += 12 }
  era = int(y / 400); yoe = y - era * 400
  doy = int((153 * (mo - 3) + 2) / 5) + d - 1
  doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
  return (era * 146097 + doe - 719468) * 86400 + h * 3600 + mi * 60 + se
}
BEGIN { t0 = 0; t1 = 0; prev = 0; act = 0; u = 0; cy = 0; hc = 0; c = 0; a = 0; r = 0; cwd = ""; anon = 0; e = 0
  mka = 0; mkm = 0; mks = 0; st = 0
  D0 = sprintf("%c", 208); D1 = sprintf("%c", 209) }
{
  line = $0
  if (sid != "" && index(line, "\"sessionId\":\"") > 0 && str(line, "sessionId") != sid) next
  if (index(line, "\"timestamp\":\"") > 0) {
    e = epoch(str(line, "timestamp"))
    if (e > 0) {
      if (t0 == 0 || e < t0) t0 = e
      if (e > t1) t1 = e
      if (prev > 0 && e > prev && e - prev < 900) act += e - prev
      if (e > prev) prev = e
    }
  }
  if (cwd == "" && index(line, "\"cwd\":\"") > 0) cwd = str(line, "cwd")
  if (index(line, "\"isApiErrorMessage\":true") > 0) {
    # A synthetic error row: not a response. A rate-limit one is a bust.
    if (index(line, "\"error\":\"rate_limit\"") > 0) {
      q = index(line, "\"quotaLimits\":{")
      if (q > 0) { qs = substr(line, q); bk[str(qs, "rateLimitType") ":" num(qs, "resetsAt")] = 1 }
      else if (e > 0) bk["t" e] = 1
    }
    next
  }
  if (index(line, "\"subtype\":\"compact_boundary\"") > 0) {
    if (str(line, "trigger") == "manual") mkm += 1; else mka += 1
    sv = num(line, "preTokens") - num(line, "postTokens"); if (sv > 0) mks += sv
    next
  }
  if (index(line, "\"subtype\":\"api_error\"") > 0) {
    if (num(line, "retryAttempt") <= 1) st += 1
    next
  }
  if (index(line, "\"type\":\"assistant\"") > 0) {
    if (index(line, "\"usage\":{") > 0) {
      id = str(line, "id")
      if (id == "" || substr(id, 1, 4) != "msg_") { anon += 1; id = "anon" anon }
      ui[id] = num(line, "input_tokens"); uo[id] = num(line, "output_tokens")
      ur[id] = num(line, "cache_read_input_tokens"); uw[id] = num(line, "cache_creation_input_tokens")
      mo = str(line, "model"); if (mo == "") mo = "unknown"
      um[id] = mo
    }
    s = line
    while (match(s, /"type":"tool_use","id":"[^"]*","name":"[^"]*"/)) {
      nm = substr(s, RSTART, RLENGTH); sub(/.*"name":"/, "", nm); sub(/"$/, "", nm)
      if (substr(nm, 1, 5) == "mcp__") nm = "MCP"
      tl[nm] += 1
      s = substr(s, RSTART + RLENGTH)
    }
  } else if (index(line, "\"type\":\"user\"") > 0) {
    if (index(line, "\"tool_result\"") == 0 && index(line, "\"isMeta\":true") == 0 && index(line, "\"isCompactSummary\":true") == 0) {
      t = str(line, "content"); if (t == "") t = str(line, "text")
      if (t != "" && substr(t, 1, 1) != "<") { u += 1; if (index(t, D0) > 0 || index(t, D1) > 0) cy += 1 }
    }
  } else if (index(line, "\"type\":\"cost-state\"") > 0) {
    hc = 1; c = num(line, "totalCostUSD"); a = num(line, "totalLinesAdded"); r = num(line, "totalLinesRemoved")
  }
}
END {
  n = 0; i = 0; o = 0; cr = 0; cw = 0
  for (k in ui) { n += 1; i += ui[k]; o += uo[k]; cr += ur[k]; cw += uw[k]; mm[um[k]] += 1 }
  sub(/\\+$/, "", cwd)
  printf "{\"t0\":%.0f,\"t1\":%.0f,\"act\":%.0f,\"n\":%.0f,\"u\":%.0f,\"cy\":%.0f,", t0, t1, act, n, u, cy
  printf "\"i\":%.0f,\"o\":%.0f,\"cr\":%.0f,\"cw\":%.0f,\"hc\":%d,\"c\":%.6f,\"a\":%.0f,\"r\":%.0f,", i, o, cr, cw, hc, c, a, r
  printf "\"cwd\":\"%s\",\"m\":{", cwd
  f = 1; for (k in mm) { printf "%s\"%s\":%.0f", (f ? "" : ","), k, mm[k]; f = 0 }
  printf "},\"tl\":{"
  f = 1; for (k in tl) { printf "%s\"%s\":%.0f", (f ? "" : ","), k, tl[k]; f = 0 }
  printf "},\"bk\":["
  f = 1; for (k in bk) { printf "%s\"%s\"", (f ? "" : ","), k; f = 0 }
  printf "],\"mka\":%.0f,\"mkm\":%.0f,\"mks\":%.0f,\"st\":%.0f}\n", mka, mkm, mks, st
}
`

function str(s: string, key: string): string {
  const p = `"${key}":"`
  const at = s.indexOf(p)
  if (at < 0) return ''
  const rest = s.slice(at + p.length)
  const end = rest.indexOf('"')
  return end < 0 ? '' : rest.slice(0, end)
}

function num(s: string, key: string): number {
  const p = `"${key}":`
  const at = s.indexOf(p)
  if (at < 0) return 0
  const m = /^-?[0-9.]+([eE][-+]?[0-9]+)?/.exec(s.slice(at + p.length, at + p.length + 32))
  return m ? Number(m[0]) || 0 : 0
}

/** ISO 8601 UTC → epoch seconds, matching the awk; 0 when unreadable. */
export function epochSeconds(ts: string): number {
  const ms = Date.UTC(
    Number(ts.slice(0, 4)),
    Number(ts.slice(5, 7)) - 1,
    Number(ts.slice(8, 10)),
    Number(ts.slice(11, 13)),
    Number(ts.slice(14, 16)),
    Number(ts.slice(17, 19)),
  )
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
}

const TOOL_USE = /"type":"tool_use","id":"[^"]*","name":"([^"]*)"/g
const CYRILLIC = /[Ѐ-ӿ]/

/** The awk program in TypeScript, for transcripts read through $.fs (≤ 4 MiB). */
export function summarizeText(text: string, sid = ''): FileSummary {
  let t0 = 0, t1 = 0, prev = 0, act = 0, u = 0, cy = 0, hc = 0, c = 0, a = 0, r = 0, anon = 0, e = 0
  let mka = 0, mkm = 0, mks = 0, st = 0
  let cwd = ''
  const bk = new Set<string>()
  const usage = new Map<string, { i: number; o: number; cr: number; cw: number; m: string }>()
  const tl: Record<string, number> = {}

  for (const line of text.split('\n')) {
    if (!line) continue
    if (sid !== '' && line.includes('"sessionId":"') && str(line, 'sessionId') !== sid) continue
    if (line.includes('"timestamp":"')) {
      e = epochSeconds(str(line, 'timestamp'))
      if (e > 0) {
        if (t0 === 0 || e < t0) t0 = e
        if (e > t1) t1 = e
        if (prev > 0 && e > prev && e - prev < 900) act += e - prev
        if (e > prev) prev = e
      }
    }
    if (cwd === '' && line.includes('"cwd":"')) cwd = str(line, 'cwd')
    if (line.includes('"isApiErrorMessage":true')) {
      if (line.includes('"error":"rate_limit"')) {
        const q = line.indexOf('"quotaLimits":{')
        if (q >= 0) {
          const qs = line.slice(q)
          bk.add(`${str(qs, 'rateLimitType')}:${num(qs, 'resetsAt')}`)
        } else if (e > 0) bk.add(`t${e}`)
      }
      continue
    }
    if (line.includes('"subtype":"compact_boundary"')) {
      if (str(line, 'trigger') === 'manual') mkm += 1
      else mka += 1
      const saved = num(line, 'preTokens') - num(line, 'postTokens')
      if (saved > 0) mks += saved
      continue
    }
    if (line.includes('"subtype":"api_error"')) {
      if (num(line, 'retryAttempt') <= 1) st += 1
      continue
    }
    if (line.includes('"type":"assistant"')) {
      if (line.includes('"usage":{')) {
        let id = str(line, 'id')
        if (!id.startsWith('msg_')) id = `anon${++anon}`
        usage.set(id, {
          i: num(line, 'input_tokens'),
          o: num(line, 'output_tokens'),
          cr: num(line, 'cache_read_input_tokens'),
          cw: num(line, 'cache_creation_input_tokens'),
          m: str(line, 'model') || 'unknown',
        })
      }
      for (const hit of line.matchAll(TOOL_USE)) {
        const name = hit[1]?.startsWith('mcp__') ? 'MCP' : hit[1] ?? ''
        tl[name] = (tl[name] ?? 0) + 1
      }
    } else if (line.includes('"type":"user"')) {
      if (!line.includes('"tool_result"') && !line.includes('"isMeta":true') && !line.includes('"isCompactSummary":true')) {
        const t = str(line, 'content') || str(line, 'text')
        if (t !== '' && !t.startsWith('<')) {
          u += 1
          if (CYRILLIC.test(t)) cy += 1
        }
      }
    } else if (line.includes('"type":"cost-state"')) {
      hc = 1
      c = num(line, 'totalCostUSD')
      a = num(line, 'totalLinesAdded')
      r = num(line, 'totalLinesRemoved')
    }
  }

  let n = 0, i = 0, o = 0, cr = 0, cw = 0
  const m: Record<string, number> = {}
  for (const v of usage.values()) {
    n += 1
    i += v.i
    o += v.o
    cr += v.cr
    cw += v.cw
    m[v.m] = (m[v.m] ?? 0) + 1
  }
  return { t0, t1, act, n, u, cy, i, o, cr, cw, hc, c, a, r, cwd: cwd.replace(/\\+$/, ''), m, tl, bk: [...bk], mka, mkm, mks, st }
}

/** Validates awk output; returns null for anything that is not a summary. */
export function parseSummary(json: string): FileSummary | null {
  try {
    const v = JSON.parse(json.trim()) as Partial<FileSummary>
    const fields = ['t0', 't1', 'act', 'n', 'u', 'cy', 'i', 'o', 'cr', 'cw', 'hc', 'c', 'a', 'r', 'mka', 'mkm', 'mks', 'st'] as const
    for (const f of fields) if (typeof v[f] !== 'number' || !Number.isFinite(v[f])) return null
    if (typeof v.cwd !== 'string' || typeof v.m !== 'object' || typeof v.tl !== 'object' || !v.m || !v.tl) return null
    if (!Array.isArray(v.bk) || !v.bk.every(k => typeof k === 'string')) return null
    return v as FileSummary
  } catch {
    return null
  }
}

/** "/Users/me/code/demo-app" → "demo-app"; JSON escapes in the raw cwd are undone. */
export function projectName(cwd: string): string {
  let path = cwd
  try {
    path = JSON.parse(`"${cwd}"`) as string
  } catch {
    // keep the raw text
  }
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? '—'
}

export function emptySummary(): FileSummary {
  return { t0: 0, t1: 0, act: 0, n: 0, u: 0, cy: 0, i: 0, o: 0, cr: 0, cw: 0, hc: 0, c: 0, a: 0, r: 0, cwd: '', m: {}, tl: {}, bk: [], mka: 0, mkm: 0, mks: 0, st: 0 }
}

function addMap(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}

/** Two summaries of disjoint transcripts as one (awk runs in chunks of files). */
export function mergeSummaries(a: FileSummary, b: FileSummary): FileSummary {
  const firstOf = (x: number, y: number) => (x === 0 ? y : y === 0 ? x : Math.min(x, y))
  return {
    t0: firstOf(a.t0, b.t0),
    t1: Math.max(a.t1, b.t1),
    act: a.act + b.act,
    n: a.n + b.n,
    u: a.u + b.u,
    cy: a.cy + b.cy,
    i: a.i + b.i,
    o: a.o + b.o,
    cr: a.cr + b.cr,
    cw: a.cw + b.cw,
    hc: a.hc || b.hc,
    c: a.c + b.c,
    a: a.a + b.a,
    r: a.r + b.r,
    cwd: a.cwd || b.cwd,
    m: addMap(a.m, b.m),
    tl: addMap(a.tl, b.tl),
    bk: [...new Set([...a.bk, ...b.bk])],
    mka: a.mka + b.mka,
    mkm: a.mkm + b.mkm,
    mks: a.mks + b.mks,
    st: a.st + b.st,
  }
}
