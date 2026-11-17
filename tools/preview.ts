// Mock-ups of what Vice Code draws, without installing the mod: a desktop window, a
// terminal and the install steps, built from the same data and pictures the mod uses.
// The words around the pictures are laid out by this file, so it is a mock-up of the
// surfaces, not a screenshot of them.
//
//   npx -y esbuild@0.24.0 tools/preview.ts --bundle --platform=node --format=esm --outfile=preview/out/preview.mjs
//   node preview/out/preview.mjs          your own history  → preview/out/index.html
//   node preview/out/preview.mjs --demo   made-up numbers   → preview/out/mocks.html (safe to share)
//   node preview/out/preview.mjs --shots  made-up numbers   → preview/out/shots/*.html, one window each,
//                                         for the pictures in the README (docs/img)
//
// index.html holds your own numbers and project names: preview/out/ is git-ignored.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Hud, Importing, Lang, LimitsState, Radio, Records, Totals, UiState } from '../types'
import { mapSvg, meterSvg, starsSvg, toneFor, wrap } from '../hooks/lib/card'
import { TOD_LABEL } from '../hooks/lib/content'
import type { FileSummary, StoredSummary } from '../hooks/lib/history'
import { AWK_PROGRAM, mergeSummaries, parseSummary, toStored } from '../hooks/lib/history'
import { LABELS } from '../hooks/lib/i18n'
import { bustedData, cardData, hudData, liteCardData, paneModel, spinnerWord, starsText, textBar, wantedLabel, weaponFor } from '../hooks/lib/model'
import { emptyMemory, fmtResetAt } from '../hooks/lib/wanted'
import type { Snapshot } from '../hooks/lib/model'
import type { Paper } from '../hooks/lib/tiles'
import { backdropSvg, bustedSvg, scenePixels, stripSvg } from '../hooks/lib/tiles'
import { totalsFromSummaries } from '../hooks/lib/stats'
import { localOffsetMinutes } from '../hooks/lib/time'
import type { TimeOfDay } from '../hooks/lib/time'

// Next to the bundle (preview/out/preview.mjs), wherever it is run from.
const OUT = dirname(fileURLToPath(import.meta.url))
const isShots = process.argv.includes('--shots')
const isDemo = isShots || process.argv.includes('--demo')

function awk(paths: string[], sid: string): FileSummary | null {
  let total: FileSummary | null = null
  for (let i = 0; i < paths.length; i += 200) {
    try {
      const json = execFileSync('awk', ['-v', `sid=${sid}`, AWK_PROGRAM, ...paths.slice(i, i + 200)], {
        env: { ...process.env, LC_ALL: 'C' },
        maxBuffer: 8 << 20,
      }).toString()
      const s = parseSummary(json)
      if (!s) return null
      total = total ? mergeSummaries(total, s) : s
    } catch {
      return null
    }
  }
  return total
}

function walk(dir: string, depth: number, out: string[]): void {
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const n of names) {
    const p = join(dir, n)
    const st = statSync(p)
    if (st.isFile() && n.endsWith('.jsonl')) out.push(p)
    else if (st.isDirectory() && depth > 0) walk(p, depth - 1, out)
  }
}

function summaries(): Record<string, StoredSummary> {
  const dir = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects')
  const out: Record<string, StoredSummary> = {}
  let projects: string[] = []
  try {
    projects = readdirSync(dir)
  } catch {
    return out
  }
  for (const p of projects) {
    const pdir = join(dir, p)
    if (!statSync(pdir).isDirectory()) continue
    for (const f of readdirSync(pdir)) {
      const path = join(pdir, f)
      const st = statSync(path)
      if (st.isFile() && f.endsWith('.jsonl')) {
        const s = awk([path], f.slice(0, -6))
        if (s) out[`${p}/${f}`] = toStored(s, st.size, st.mtimeMs, false)
      } else if (st.isDirectory()) {
        const files: string[] = []
        walk(join(path, 'subagents'), 4, files)
        const s = files.length ? awk(files, '') : null
        if (s) out[`${p}/${f}/subagents`] = toStored(s, 0, 0, true)
      }
    }
  }
  return out
}

/** Made-up sessions for the shareable mock-up: nobody's real projects or numbers. */
function demoSummaries(now: number): Record<string, StoredSummary> {
  const projects = ['harbor-app', 'ocean-api', 'neon-site', 'tidepool', 'pier-bot', 'boardwalk']
  const out: Record<string, StoredSummary> = {}
  let seed = 1986
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < 46; i++) {
    const project = projects[Math.floor(rnd() * rnd() * projects.length)] ?? 'harbor-app'
    const day = Math.floor(i / 2.4)
    const t0 = Math.floor(now / 1000) - day * 86_400 - Math.floor(rnd() * 30_000) - 3600
    const act = 900 + Math.floor(rnd() * 6200)
    const n = 20 + Math.floor(rnd() * 160)
    out[`-home-alex-${project}/s${i}.jsonl`] = {
      t0, t1: t0 + act + 400, act, n, u: 3 + Math.floor(rnd() * 14), cy: 0,
      i: 40_000 + Math.floor(rnd() * 90_000), o: 30_000 + Math.floor(rnd() * 260_000),
      cr: 4_000_000 + Math.floor(rnd() * 38_000_000), cw: 300_000 + Math.floor(rnd() * 1_500_000),
      hc: 1, c: 4 + rnd() * 38, a: 300 + Math.floor(rnd() * 5200), r: Math.floor(rnd() * 900),
      m: i % 4 === 0 ? { 'claude-sonnet-5-5': n } : { 'claude-opus-5-5': n },
      tl: { Bash: 10 + Math.floor(rnd() * 90), Read: 14 + Math.floor(rnd() * 70), Edit: 6 + Math.floor(rnd() * 50), Grep: Math.floor(rnd() * 30), Write: Math.floor(rnd() * 9), WebSearch: Math.floor(rnd() * 5) },
      bk: i % 9 === 4 ? [`five_hour:${t0 + 7200}`] : [],
      mka: i % 3 === 0 ? 1 : 0, mkm: i % 7 === 0 ? 1 : 0, mks: i % 3 === 0 ? 120_000 + Math.floor(rnd() * 90_000) : 0,
      st: i % 11 === 0 ? 1 : 0,
      p: project, size: 100_000, mtime: (t0 + act) * 1000,
    } as StoredSummary
  }
  return out
}

const offset = localOffsetMinutes()
const t0 = Date.now()
// The README's pictures are taken on a fixed day, a while after the countdown, so they do not age.
const today = isShots ? new Date(2026, 11, 5) : new Date()
const at = (h: number, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime()
const stored = isDemo ? demoSummaries(at(18)) : summaries()
const totals: Totals = totalsFromSummaries(stored, offset)
// The same rule as the mod: the macOS account's first name, else the login.
const realPlayer = (() => {
  try {
    return execFileSync('id', ['-F']).toString().trim().split(/\s+/)[0] || process.env.USER || 'player'
  } catch {
    return process.env.USER || 'player'
  }
})()
const playerFor = (lang: Lang) => (isDemo ? (lang === 'ru' ? 'Алекс' : 'Alex') : realPlayer)

const ui: UiState = { tab: 'general', tipShift: 0, flashUntil: 0 }
const hud: Hud = { contextPct: 62, contextTokens: 61_000, threshold: 160_000, window: 200_000, costUsd: 3.42 }
const importing: Importing = { active: false, done: 0, total: 0, lastError: null }
const records: Records = { escapes: 2, maxStars: 4 }

type Heat = 'calm' | 'hot' | 'busted'
function limitsAt(nowMs: number, heat: Heat): LimitsState {
  const mem = emptyMemory()
  if (heat === 'busted') mem.busted = { kind: 'short', until: nowMs + 72 * 60_000, since: nowMs - 60_000 }
  return {
    short: { pct: heat === 'busted' ? 100 : heat === 'hot' ? 90 : 22, resetsAt: nowMs + (heat === 'busted' ? 72 : 83) * 60_000 },
    week: { pct: 36, resetsAt: nowMs + 3 * 86_400_000 },
    spend: null,
    hasData: true,
    mem,
  }
}

function snap(lang: Lang, nowMs: number, heat: Heat, tab: UiState['tab'] = 'general', isRadioOn = false): Snapshot {
  const radio: Radio = { playing: isRadioOn, track: 0 }
  const h: Hud = heat === 'calm' ? hud : { ...hud, contextTokens: 121_000 }
  return { env: { lang, player: playerFor(lang), offset }, ui: { ...ui, tab }, totals, live: null, hud: h, importing, radio, limits: limitsAt(nowMs, heat), records, nowMs }
}

const times: Record<TimeOfDay, number> = { dawn: at(7), day: at(13), sunset: at(18), night: at(23) }
const NOW = times.sunset

// ---------- HTML ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`)
let uid = 0
const id = (p: string) => `${p}${++uid}`
/** A scene as an image: its own document, so its styles stay inside it and its CSS animates it. */
const img = (svg: string, alt: string) => `<img alt="${esc(alt)}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`

/** The desktop band: one quiet line, as the mod's AbovePrompt hook lays it out. */
function deskBand(s: Snapshot, flash: boolean): string {
  const L = LABELS[s.env.lang]
  const b = bustedData(s)
  if (b) {
    return (
      `<div class="band"><span class="bad sb">${esc(L.wanted.bustedShort)}</span><span>${esc(b.why)}</span><span class="warn md">${esc(b.until)}</span>` +
      `<span class="btn">${esc(L.buttons.stats)}</span><span class="btn">${esc(L.buttons.radioOn)}</span></div>`
    )
  }
  const hd = hudData(s, true, true)
  const stars = hd.wanted?.stars ?? 0
  const meter = (label: string, v: number | null) =>
    `<span class="grp"><span class="dim">${esc(label)}</span>${v === null ? '' : meterSvg(v)}<span class="num">${pct(v)}</span></span>`
  return (
    `<div class="band">` +
    (hd.wanted
      ? `<span class="grp"><span class="dim">${esc(hd.wanted.label)}</span>${starsSvg(stars, flash ? 'flash' : 'still')}` +
        (hd.wanted.reset && stars > 0 ? `<span class="${stars >= 3 ? 'warn ' : ''}md">${esc(hd.wanted.reset)}</span>` : '') +
        `</span>`
      : '') +
    meter(hd.healthLabel, hd.health) +
    meter(hd.armorLabel, hd.armor) +
    (hd.money ? `<span class="dim num">${esc(hd.money)}</span>` : '') +
    (hd.radio.isOn ? `<span class="dim">♪ ${esc(hd.radio.track)}</span>` : '') +
    `</div>`
  )
}

/** The welcome row, as the Placed hook lays it out on the surfaces that draw SVG. */
function deskWelcome(s: Snapshot): string {
  const L = LABELS[s.env.lang]
  const d = cardData(s)
  return (
    // The scene stands behind the conversation here, so the card is words alone.
    `<div class="rowcard">` +
    `<div><div class="cap dim">Vice Code · ${esc(d.forLine)}</div><div class="title">${esc(d.greeting)}</div></div>` +
    `<div class="tiles">${d.tiles.map(([v, l]) => `<div><div class="heading num">${esc(v)}</div><div class="cap dim">${esc(l)}</div></div>`).join('')}</div>` +
    `<div class="foot"><span class="dim">${esc(d.footer.before)}</span><span class="clay md">${esc(d.footer.strong)}</span><span class="dim">${esc(d.footer.after)}</span></div>` +
    `<div class="foot dim"><span class="clay md">${esc(d.tipLabel)}</span> · ${esc(d.tip)}</div>` +
    `<div class="btns"><span class="btn">${esc(L.buttons.stats)}</span><span class="btn">${esc(L.buttons.radioOn)}</span><span class="btn">${esc(L.buttons.nextTip)}</span><span class="cap dim">${esc(d.repo)}</span></div>` +
    `</div>`
  )
}

/** A scene that feels the pointer once the page's script moves it into a shadow root; an image until then. */
const live = (svg: string, alt: string) => `<div class="pic hov" data-svg="${Buffer.from(svg).toString('base64')}">${img(svg, alt)}</div>`

/** Lite's hello row, as the Placed hook lays it out: the banner, what changed, the way into the game. */
function deskHello(lang: Lang, nowMs: number, paper: Paper): string {
  const L = LABELS[lang]
  const d = liteCardData({ lang, player: '', offset }, nowMs)
  return (
    `<div class="rowcard">` +
    live(stripSvg(d.tod, paper, id('hs')), L.sceneAlt) +
    `<div><div class="cap dim">Vice Code · ${esc(d.forLine)}</div><div class="title">${esc(d.title)}</div></div>` +
    `<div class="say">${esc(d.body)}</div>` +
    (d.news ? `<div class="foot"><span class="dim">${esc(d.news.before)}</span><span class="clay md">${esc(d.news.strong)}</span><span class="dim">${esc(d.news.after)}</span></div>` : '') +
    `<div class="btns"><span class="btn on">${esc(L.buttons.gameOn)}</span><span class="btn">${esc(L.buttons.radioOn)}</span><span class="cap dim">${esc(d.repo)}</span></div>` +
    `<div class="cap dim">${esc(d.hint)}</div>` +
    `</div>`
  )
}

function deskBusted(s: Snapshot): string {
  const L = LABELS[s.env.lang]
  const b = bustedData(s)
  if (!b) return ''
  return (
    `<div class="rowcard">` +
    // A still page is shot before the letters land: for the README's picture they stand from the start.
    `<div class="pic">${img(isShots ? bustedSvg(b.title, b.repo, true, id('bb')).replace(/\.w\{animation:land[^}]*\}/, '') : bustedSvg(b.title, b.repo, true, id('bb')), b.title)}</div>` +
    `<div><div class="heading">${esc(b.why)}</div><div class="warn md">${esc(b.until)}</div><div class="foot dim">${esc(b.pass)}</div></div>` +
    `<div class="btns"><span class="btn">${esc(L.buttons.stats)}</span><span class="btn">${esc(L.buttons.radioOn)}</span></div>` +
    `</div>`
  )
}

type Back = { tod: TimeOfDay; heat: number; flash?: boolean }

/**
 * A stand-in for the app's own window, light or dark: a frosted sidebar, the conversation
 * straight on the backdrop (as the app draws it), the band and the prompt box.
 */
function deskWindow(lang: Lang, paper: Paper, transcript: string, band: string, mode: string | null, opt: { back?: Back; toast?: string; isStock?: boolean; typed?: string } = {}): string {
  const ru = lang === 'ru'
  const sessions = ru ? ['Починить логин', 'Лендинг: правки', 'Бот для записи', 'Миграция базы', 'Отчёт за неделю'] : ['Fix the login', 'Landing page edits', 'Booking bot', 'Database migration', 'Weekly report']
  return (
    `<div class="win desk ${paper}${opt.back ? ' glass' : ''}${opt.isStock ? ' stock' : ''}">` +
    (opt.back ? `<div class="bg">${img(backdropSvg(opt.back.tod, paper, opt.back.heat, opt.back.flash === true), '')}</div>` : '') +
    `<div class="bar"><i></i><i></i><i></i><span>${ru ? 'Claude Code — десктоп, макет' : 'Claude Code — desktop, mock-up'}</span></div>` +
    `<div class="split"><div class="side">${sessions.map((t, i) => `<span${i === 0 ? ' class="on"' : ''}>${esc(t)}</span>`).join('')}</div>` +
    `<div class="chat">` +
    (opt.toast ? `<div class="toast">${esc(opt.toast)}</div>` : '') +
    `<div class="transcript">${transcript}</div>` +
    band +
    `<div class="composer">${opt.typed ? `<span class="typed">${esc(opt.typed)}</span>` : `<span class="dim">${ru ? 'Ответить…' : 'Reply…'}</span>`}${mode ? `<span class="mode">${esc(mode)}</span>` : ''}</div>` +
    `</div></div></div>`
  )
}

const toolRow = (lang: Lang, tool: string, text: string) =>
  `<div class="tool"><span class="gear">${esc(weaponFor(tool, lang))}</span><span>${text}</span></div>`

function rasterSvg(tod: TimeOfDay, cols: number, rows: number): string {
  const px = scenePixels(tod, cols, rows * 2)
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
  let out = ''
  for (let y = 0; y < rows * 2; y++) {
    let x = 0
    while (x < cols) {
      const c = px[y]?.[x] ?? 0
      let w = 1
      while (x + w < cols && (px[y]?.[x + w] ?? 0) === c) w++
      out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${hex(c)}"/>`
      x += w
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows * 2}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:${cols}ch;height:${rows * 1.4}em">${out}</svg>`
}

const tty = (cls: string, text: string) => `<span class="${cls}">${esc(text)}</span>`

/** Lite in a terminal: the banner at the top of a new conversation, and nothing else. */
function termLite(lang: Lang): string {
  const d = liteCardData({ lang, player: '', offset }, NOW)
  const body = wrap(d.bodyPlain, 56, 3)
  const lines = [
    tty('clay b', 'Vice Code') + tty('dim', ` · ${d.forLine}`),
    tty('b', d.title),
    ...(d.news ? [tty('dim', d.news.before) + tty('clay', d.news.strong) + tty('dim', d.news.after)] : []),
    ...body.map(l => tty('dim', l)),
    tty('sub', d.hintShort),
  ]
  const hint = lang === 'ru' ? '? — подсказки' : '? for shortcuts'
  return (
    `<div class="win term dark"><div class="bar"><i></i><i></i><i></i><span>claude — ~/code/harbor-app</span></div>` +
    `<div class="ttybody"><div class="ttyrow">${rasterSvg(d.tod, 34, lines.length)}<pre>${lines.join('\n')}</pre></div>` +
    `<div class="prompt"><span class="dim">&gt;</span> </div><pre class="ttyfoot">${tty('dim', hint)}</pre></div></div>`
  )
}

/** The terminal: the welcome row with its pixel scene, a little work, then the band and the prompt. */
function termWindow(lang: Lang, heat: Heat, theme: 'dark' | 'light', withWelcome: boolean): string {
  const s = snap(lang, NOW, heat, 'general', heat === 'hot')
  const L = LABELS[lang]
  let body = ''
  if (withWelcome) {
    const d = cardData(s)
    const cols = 34
    const tip = wrap(`${d.tipLabel} · ${d.tip}`, 52, 2)
    const lines = [
      tty('clay b', 'Vice Code') + tty('dim', ` · ${d.forLine}`),
      tty('b', d.greeting),
      tty('b', d.tiles[0]?.[0] ?? '') + tty('dim', ` ${d.tiles[0]?.[1] ?? ''} · `) + tty('b', d.tiles[1]?.[0] ?? '') + tty('dim', ` ${d.tiles[1]?.[1] ?? ''}`),
      tty('b', d.tiles[2]?.[0] ?? '') + tty('dim', ` ${d.tiles[2]?.[1] ?? ''} · ${d.tiles[3]?.[1] ?? ''} `) + tty('b', d.tiles[3]?.[0] ?? ''),
      tty('dim', d.footer.before) + tty('clay', d.footer.strong) + tty('dim', d.footer.after),
      ...tip.map(l => tty('dim', l)),
      tty('sub', L.welcomeHint),
    ]
    body += `<div class="ttyrow">${rasterSvg(d.tod, cols, lines.length)}<pre>${lines.join('\n')}</pre></div>\n`
  }
  const b = bustedData(s)
  let work = ''
  if (!withWelcome || heat !== 'calm') {
    work +=
      `\n${tty('dim', '>')} ${esc(lang === 'ru' ? 'почини тест логина и прогони всё' : 'fix the login test and run the suite')}\n\n` +
      `${tty('warn b', weaponFor('Read', lang))} ${tty('ok', '⏺')} Read(src/auth/login.ts)\n` +
      `${tty('warn b', weaponFor('Edit', lang))} ${tty('ok', '⏺')} Update(src/auth/login.ts)\n` +
      `${tty('warn b', weaponFor('Bash', lang))} ${tty('ok', '⏺')} Bash(npm test)\n`
  }
  if (b) {
    work +=
      `\n${tty('err', '▀▀▀▀▀▀▀▀')}${tty('sug', '▀▀▀▀▀▀▀▀')}\n` +
      `${tty('inv', ` ${b.title} `)} ${esc(b.why)}\n${tty('warn b', b.until)}\n${tty('dim', b.pass)}\n`
  } else if (heat === 'hot') {
    work += `\n${tty('clay', '✻')} ${tty('clay', spinnerWord(lang, 'thinking', 7, 4) + '…')} ${tty('dim', lang === 'ru' ? '(esc — прервать)' : '(esc to interrupt)')}\n`
  }
  let band = ''
  if (b) {
    band = tty('err b', L.wanted.bustedShort) + tty('dim', ' · ') + esc(b.why) + tty('dim', ' · ') + tty('warn', b.until) + `\n${tty('btn', `[ s: ${L.buttons.stats} ]`)} ${tty('btn', `[ r: ${L.buttons.radioOn} ]`)}`
  } else {
    const hd = hudData(s, true, true)
    const stars = hd.wanted?.stars ?? 0
    const tone = { ok: 'ok', warn: 'warn', bad: 'err' } as const
    band =
      tty(stars >= 3 ? 'err' : stars > 0 ? 'warn' : 'sub', `${starsText(stars)} `) +
      tty('dim', `${stars > 0 && hd.wanted?.reset ? hd.wanted.reset : (hd.wanted?.clean ?? '')}  `) +
      tty('dim', `${hd.healthLabel} `) + tty(tone[toneFor(hd.health)], textBar((hd.health ?? 0) / 100, 6)) + ` ${pct(hd.health)}  ` +
      tty('dim', `${hd.armorLabel} `) + tty(tone[toneFor(hd.armor)], textBar((hd.armor ?? 0) / 100, 6)) + ` ${pct(hd.armor)}  ` +
      tty('dim', `${hd.money ?? ''}  `) + (hd.radio.isOn ? tty('dim', `♪ ${hd.radio.track}`) : '')
  }
  const mode = wantedLabel(s)
  const hint = lang === 'ru' ? '? — подсказки' : '? for shortcuts'
  return (
    `<div class="win term ${theme}"><div class="bar"><i></i><i></i><i></i><span>claude — ~/code/harbor-app</span></div>` +
    `<div class="ttybody">${body}<pre>${work}</pre><pre class="ttyband">${band}</pre>` +
    `<div class="prompt"><span class="dim">&gt;</span> </div>` +
    `<pre class="ttyfoot">${tty('dim', hint)}${mode ? `<span class="right">${esc(mode)}</span>` : ''}</pre></div></div>`
  )
}

function paneWindow(lang: Lang, tab: UiState['tab']): string {
  const s = snap(lang, NOW, 'hot', tab)
  const L = LABELS[lang]
  const m = paneModel(s)
  const row = (r: { label: string; value: string }) => `<div class="prow"><span class="dim">${esc(r.label)}</span><span class="md num">${esc(r.value)}</span></div>`
  return (
    `<div class="win pane dark"><div class="bar"><i></i><i></i><i></i><span>Vice Code</span></div><div class="panebody">` +
    `<div class="pic">${img(stripSvg('sunset', 'dark', id('ps')), L.sceneAlt)}</div>` +
    `<div><div class="cap dim">Vice Code</div><div class="heading">${esc(L.statsTitle)}</div></div>` +
    `<div class="btns">${m.tabs.map(t => `<span class="btn${t.id === m.tab ? ' on' : ''}">${esc(t.label)}</span>`).join('')}</div>` +
    (m.tab === 'map' && m.districts.length ? `<div class="pic">${mapSvg(m.districts, m.current, id('mp'))}</div>` : '') +
    `<div>${m.rows.map(row).join('')}</div>` +
    (m.note ? `<div class="cap dim">${esc(m.note)}</div>` : '') +
    `</div></div>`
  )
}

/** Everything one language shows. */
function mocks(lang: Lang): Record<string, string> {
  const L = LABELS[lang]
  const ru = lang === 'ru'
  const calm = snap(lang, NOW, 'calm')
  const day = snap(lang, times.day, 'calm')
  const hot = snap(lang, NOW, 'hot', 'general', true)
  const bust = snap(lang, times.night, 'busted')
  const resetAt = fmtResetAt(NOW + 83 * 60_000, NOW, offset, lang)
  const toast = L.wanted.starToast(starsText(4), L.wanted.levels[3], '90%', resetAt)
  const you = (t: string) => `<div class="you">${esc(t)}</div>`
  const say = (t: string) => `<div class="say">${t}</div>`
  const work =
    you(ru ? 'почини тест логина и прогони всё' : 'fix the login test and run the suite') +
    toolRow(lang, 'Read', ru ? 'Прочитан <code>src/auth/login.ts</code>' : 'Read <code>src/auth/login.ts</code>') +
    toolRow(lang, 'Edit', ru ? 'Изменён <code>src/auth/login.ts</code>' : 'Edited <code>src/auth/login.ts</code>') +
    toolRow(lang, 'Bash', ru ? 'Выполнено <code>npm test</code>' : 'Ran <code>npm test</code>')
  // The same work without the game: no gear on the rows, no band, the app's own spinner.
  const plainWork =
    you(ru ? 'почини тест логина и прогони всё' : 'fix the login test and run the suite') +
    [ru ? 'Прочитан <code>src/auth/login.ts</code>' : 'Read <code>src/auth/login.ts</code>', ru ? 'Изменён <code>src/auth/login.ts</code>' : 'Edited <code>src/auth/login.ts</code>', ru ? 'Выполнено <code>npm test</code>' : 'Ran <code>npm test</code>']
      .map(t => `<div class="tool"><span>${t}</span></div>`)
      .join('') +
    say(ru ? 'Тест падал из-за просроченного токена в фикстуре. Обновил фикстуру, все 148 тестов проходят.' : 'The test failed on an expired token in the fixture. I refreshed the fixture; all 148 tests pass.')
  const answer = say(ru ? 'Тест падал из-за просроченного токена в фикстуре. Обновил фикстуру, все 148 тестов проходят.' : 'The test failed on an expired token in the fixture. I refreshed the fixture; all 148 tests pass.')
  return {
    // Before: the app as it comes, with the install line typed.
    before: deskWindow(lang, 'dark', plainWork, '', null, { isStock: true, typed: '/plugin install vice-code --marketplace RebSem/vice-code' }),
    liteHello: deskWindow(lang, 'dark', deskHello(lang, NOW, 'dark'), '', null, { back: { tod: 'sunset', heat: 0 } }),
    liteWork: deskWindow(lang, 'dark', plainWork, '', null, { back: { tod: 'night', heat: 0 } }),
    liteLight: deskWindow(lang, 'light', plainWork, '', null, { back: { tod: 'day', heat: 0 } }),
    liteDawn: deskWindow(lang, 'light', deskHello(lang, times.dawn, 'light'), '', null, { back: { tod: 'dawn', heat: 0 } }),
    welcome: deskWindow(lang, 'dark', deskWelcome(calm), deskBand(calm, false), null, { back: { tod: 'sunset', heat: 0 } }),
    plain: deskWindow(lang, 'light', deskWelcome(day), deskBand(day, false), null, { back: { tod: 'day', heat: 0 } }),
    work: deskWindow(
      lang, 'dark',
      work + answer + `<div class="spin"><span class="clay">✻</span> ${esc(spinnerWord(lang, 'thinking', 3, 4))}…</div>`,
      deskBand(hot, true), wantedLabel(hot), { toast, back: { tod: 'sunset', heat: 4, flash: true } },
    ),
    busted: deskWindow(lang, 'dark', work + deskBusted(bust), deskBand(bust, true), wantedLabel(bust), { back: { tod: 'night', heat: 5, flash: true } }),
    paneRap: paneWindow(lang, 'rap'),
    paneGeneral: paneWindow(lang, 'general'),
    paneMap: paneWindow(lang, 'map'),
    termLite: termLite(lang),
    termWelcome: termWindow(lang, 'calm', 'dark', true),
    termHot: termWindow(lang, 'hot', 'dark', false),
    termBusted: termWindow(lang, 'busted', 'dark', false),
    termLight: termWindow(lang, 'hot', 'light', false),
  }
}

const M = { ru: mocks('ru'), en: mocks('en') }
const both = (key: string) => `<div data-l="ru">${M.ru[key] ?? ''}</div><div data-l="en">${M.en[key] ?? ''}</div>`
const scenes = (Object.keys(times) as TimeOfDay[])
  .flatMap(tod => (['dark', 'light'] as const).map(paper => `<figure class="scene">${img(stripSvg(tod, paper, id('tod')), TOD_LABEL.en[tod])}<figcaption>${esc(TOD_LABEL.ru[tod].toLowerCase())} · ${paper === 'dark' ? 'тёмное окно' : 'светлое окно'}</figcaption></figure>`))
  .join('')

const install = [
  ['$', 'claude plugin install vice-code --marketplace RebSem/vice-code'],
  ['', 'Adding marketplace…'],
  ['ok', '✔ Successfully added marketplace: vice-code (declared in user settings)'],
  ['', 'Installing plugin "vice-code@vice-code"...'],
  ['ok', '✔ Successfully installed plugin: vice-code@vice-code (scope: user)'],
  ['dim', '17 userConfig options not yet set — run /plugin configure vice-code@vice-code in Claude Code, or pass --config KEY=VALUE.'],
  ['$', 'claude'],
]
  .map(([k, t]) => (k === '$' ? `<span class="dim">$</span> <span class="b">${esc(t ?? '')}</span>` : `<span class="${k}">${esc(t ?? '')}</span>`))
  .join('\n')

const css = readFileSync(join(dirname(OUT), 'mocks.css'), 'utf8')
const page = readFileSync(join(dirname(OUT), 'mocks.body.html'), 'utf8')
  .replace(/\{\{(\w+)\}\}/g, (_, k: string) => (k === 'scenes' ? scenes : k === 'install' ? install : k === 'css' ? css : both(k)))

mkdirSync(OUT, { recursive: true })
if (isShots) {
  // One window per page, at a fixed size, for a screenshot: the README's pictures.
  const shots: Record<string, [key: string, width: number]> = {
    'lite-dark': ['liteHello', 1280],
    'lite-light': ['liteLight', 1280],
    'full-wanted': ['work', 1280],
    busted: ['busted', 1280],
    terminal: ['termWelcome', 860],
    'terminal-lite': ['termLite', 860],
  }
  mkdirSync(join(OUT, 'shots'), { recursive: true })
  for (const [name, [key, width]] of Object.entries(shots)) {
    const html = `<!doctype html><meta charset="utf-8"><style>${css}html,body{margin:0;background:transparent}body{width:${width}px;padding:0}.win{border-radius:0;border:0;box-shadow:none}.desk .split{min-height:752px}.desk .chat{max-width:600px;padding-bottom:22px}</style><div class="shot">${M.en[key] ?? ''}</div>`
    writeFileSync(join(OUT, 'shots', `${name}.html`), html)
  }
  console.log(`${join(OUT, 'shots')} — ${Object.keys(shots).length} pages`)
} else {
  const file = join(OUT, isDemo ? 'mocks.html' : 'index.html')
  // The shareable page is a fragment for publishing; the local one opens as a file.
  writeFileSync(file, isDemo ? page : `<!doctype html><meta charset="utf-8">${page}`)
  console.log(`${file} — ${totals.sessions} sessions, ${Object.keys(stored).length} transcripts, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}
