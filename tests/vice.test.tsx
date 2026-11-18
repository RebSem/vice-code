import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { meterSvg, starsSvg, toneFor } from '../hooks/lib/card'
import { fmtCompact, fmtMoney } from '../hooks/lib/format'
import { bustedRowId, isTooOld } from '../hooks/lib/model'
import { register } from '../hooks/register'
import { mergeSummaries, summarizeText } from '../hooks/lib/history'
import { sound } from '../hooks/lib/synth'
import { look, unpainted } from '../hooks/lib/look'
import { backdropSvg, stripSvg } from '../hooks/lib/dusk'
import { bustedSvg, iconSvg, PAGE, scenePixels } from '../hooks/lib/tiles'
import { GAME_LABEL } from '../hooks/lib/time'
import { countBusts, emptyMemory, fmtLeft, fmtResetAt, mergeMemory, rejectedBy, starsFor } from '../hooks/lib/wanted'

const BAND = {
  plugin: 'vice-code',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 14, bodyColumns: 100, scroll: { offset: 0, bodyRows: 13 }, view: {} },
} as const

const PANE = {
  plugin: 'vice-code',
  component: 'Pane',
  requestId: 'vice-stats',
  props: { title: 'Vice Code', isFocused: false, bodyColumns: 46, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

/** A row the mod placed in the conversation: the welcome card or a busted card. */
const row = (id: string) => ({ plugin: 'vice-code', component: 'Placed', props: { id, plugin: 'vice-code' } }) as const

const SPINNER = {
  plugin: 'vice-code',
  component: 'Spinner',
  props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
} as const

const COMMAND = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

// One summarized transcript, as the awk program prints it. Synthetic numbers.
const SUMMARY = JSON.stringify({
  t0: 1792000000, t1: 1792007200, act: 5400, n: 120, u: 12, cy: 0,
  i: 1000, o: 200_000, cr: 1_000_000, cw: 50_000, hc: 1, c: 12.5, a: 1500, r: 40,
  cwd: '/home/user/demo-app', m: { 'claude-opus-5-5': 100, 'claude-haiku-5-5': 20 }, tl: { Bash: 60, Edit: 25, Read: 9 },
  bk: ['five_hour:1792003000'], mka: 2, mkm: 1, mks: 90_000, st: 1,
})

type Stubs = {
  withHistory?: boolean
  turnsSoFar?: number
  audioResolvesAtOnce?: boolean
  store?: Record<string, unknown>
  engine?: string
  /** Where the session draws; a window that has not attached yet is an empty list. */
  surfaces?: string[]
  /** False: no surface draws the look (a terminal, an editor). */
  isLookDrawn?: boolean
  /** True: an engine from before the colors, which refuses a theme that has them. */
  refusesColors?: boolean
}

const NOW = Date.UTC(2026, 9, 27, 15, 30)
type Limit = { kind: string; percentUsed: number; resetsAt?: string }
type Usage = { limits: Limit[]; tokens: number; percent: number; threshold: number; cost: number }

/** Every call the mod makes on $ that the kit does not answer by itself. */
function stubEngine(on: On, stubs: Stubs = {}) {
  const clock = mock.clock(on, { now: NOW })
  // What $.session.usage() answers; a test changes it to move the limits.
  const usage: Usage = { limits: [{ kind: 'five_hour', percentUsed: 29, resetsAt: new Date(NOW + 3 * 3_600_000).toISOString() }], tokens: 124_000, percent: 62, threshold: 160_000, cost: 3.42 }
  const toasts: string[] = []
  const plays: number[] = []
  // Rows placed in the conversation, and what happened to the session's theme.
  const placed: string[] = []
  const themes: string[] = []
  // Which modes of the colors each look carried (empty on an engine from before the colors).
  const modes: string[] = []
  // Any mode a look asked the window to switch to: none is ever expected.
  const overrides: string[] = []
  let rosterReads = 0
  // What the mod asked of the machine: processes run and folders listed.
  const runs: string[] = []
  const world: { surfaces: string[]; isLookDrawn: boolean; sessionId: string; turns?: number } = { surfaces: stubs.surfaces ?? ['desktop'], isLookDrawn: stubs.isLookDrawn ?? true, sessionId: 'live-session' }
  on('session.version', () => ({ value: { version: stubs.engine ?? '2.1.321', base: stubs.engine ?? '2.1.321' } as never }))
  on('ui.place', (_, e) => {
    placed.push(e.id)
    return { value: { isPlaced: true } as never }
  })
  on('theme.set', (_, e) => {
    // The newest engines name the scene `scene`, the ones before them `id`; an engine
    // from before the colors drops them, so a look of colors alone arrives empty there.
    const look = e as { backdrop?: { scene?: string; id?: string }; colors?: unknown; overrideColorScheme?: string }
    if (look.overrideColorScheme) overrides.push(look.overrideColorScheme)
    if (stubs.refusesColors && look.colors) throw new Error('theme.set: unknown member colors')
    themes.push(look.backdrop?.scene ?? look.backdrop?.id ?? 'colors')
    const inputs = (look.colors as { inputs?: Record<string, unknown> } | undefined)?.inputs
    if (inputs) modes.push(Object.keys(inputs).sort().join('+'))
    return { value: world.isLookDrawn ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, reason: 'no surface draws themes' } }
  })
  on('session.surfaces', () => {
    rosterReads += 1
    return { value: world.surfaces as never }
  })
  on('session.attach', (_, e) => ({ clientId: e.clientId }))
  on('theme.clear', () => {
    themes.push('clear')
    return { value: { isDrawn: false, reason: 'cleared' } }
  })
  mock.store(on, stubs.store)
  mock.env(on, { HOME: '/home/user', LANG: 'en_US.UTF-8', USER: 'alex' })
  on('session.id', () => ({ value: world.sessionId }))
  on('session.end', () => ({ sessionId: world.sessionId }) as never)
  on('session.root', () => ({ value: '/home/user/vice-code' }))
  on('session.turns', () => ({ value: world.turns ?? stubs.turnsSoFar ?? 0 }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        window: 200_000,
        tokens: usage.tokens,
        percent: usage.percent,
        breakdown: { autoCompactThreshold: usage.threshold } as never,
      },
      rateLimits: usage.limits,
      cost: { usd: usage.cost },
    },
  }))
  on('command.register', () => ({ value: { command: 'vice' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('audio.play', async (_, e) => {
    plays.push(e.shouldLoop ? 0 : 1)
    // A real player holds the promise for the whole loop; with no player it resolves at once.
    if (!stubs.audioResolvesAtOnce) await clock.sleep(600_000)
    return { value: undefined }
  })
  const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_, e) => {
    const argv = e.argv
    runs.push(String(argv[0]))
    if (argv[0] === 'date') return ok('+0300\n')
    if (argv[0] === 'id') return ok('Alex Example\n')
    if (argv[0] === 'awk') return ok(SUMMARY + '\n')
    return { value: { exitCode: 1, stdout: '', stderr: 'no', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => {
    runs.push('fs')
    return { value: stubs.withHistory === true }
  })
  on('fs.list', (_, e) => {
    const path = String(e.path)
    if (path.endsWith('/projects')) return { value: [{ name: '-home-user-demo-app', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
    if (path.endsWith('/-home-user-demo-app')) {
      return {
        value: [
          { name: 'old-session.jsonl', kind: 'file', size: 32_000, mtimeMs: 1_792_007_200_000, isLink: false },
          { name: 'live-session.jsonl', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
          { name: 'notes.txt', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
        ],
      }
    }
    return { value: [] }
  })
  on('fs.read', () => ({ value: '' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('tool.call', (_, e) => {
    if (e.tool === 'Edit') return { result: { structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [' a', '-b', '+c', '+d'] }] } }
    if (e.tool === 'Write') return { result: { type: 'create', filePath: '/x/new.ts', content: 'a\nb\nc', structuredPatch: [], originalFile: null } }
    return { result: {} }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (e.component === 'Spinner') return <Text>{`spin:${e.props.word}`}</Text>
    return <Text>engine</Text>
  })
  // The kit's clock is frozen, so hand back a plain object with what the tests use.
  return {
    advance: (ms: number) => clock.advance(ms),
    settle: () => clock.settle(),
    usage,
    toasts,
    plays,
    placed,
    themes,
    modes,
    overrides,
    rosterReads: () => rosterReads,
    runs,
    world,
  }
}

/** Raises a usage measurement the way the engine does after a turn. */
async function measure($: Engine, u: Usage) {
  await $.session.measure({
    context: { window: 200_000, tokens: u.tokens, percent: u.percent },
    rateLimits: u.limits,
    cost: { usd: u.cost },
    changed: ['context', 'rateLimits', 'cost'],
  })
}

/**
 * A main-loop turn that dies on an API error, as the engine sends it: no answer, and by
 * default after the seconds its retries take. `usage` is what earlier steps that worked left.
 */
async function failTurn($: Engine, turnId: string, durationMs = 8000, usage?: Record<string, unknown>) {
  await $.turn.start({ text: 'go', turnId })
  await $.turn.complete({ answer: '', durationMs, isAborted: false, turnId, reason: 'error', ...(usage ? { usage } : {}) } as never)
}

type Stubbed = ReturnType<typeof stubEngine>

/** /clear: the conversation ends, and a moment later the process goes on under another id. */
async function clearTo($: Engine, eng: Stubbed, nextId: string) {
  await $.session.end({ reason: 'clear', sessionId: eng.world.sessionId } as never)
  eng.world.sessionId = nextId
  await eng.advance(200)
  await eng.settle()
}

test('a new session places a welcome card in the conversation and a quiet HUD above the prompt', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/home/user/vice-code', surface: 'desktop', isInteractive: true })
  expect(eng.placed).toHaveLength(1)
  const welcome = eng.placed[0] ?? ''
  expect(welcome.startsWith('welcome-')).toBe(true)

  // The card is the surface's own text under a picture, on every surface that draws SVG.
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const card = await $.ui.mount({ ...row(welcome), surface })
    const scene = await card.find({ type: 'Svg' })
    if (surface === 'vscode') {
      expect(String(scene?.props.source), 'the picture holds no words of the card').not.toContain('Alex')
      expect(String(scene?.props.source), 'and follows the window').toContain('prefers-color-scheme')
    } else {
      expect(scene, `on ${surface} the backdrop is the picture`).toBeUndefined()
    }
    expect(await card.find({ type: 'Text', text: /Alex/ }), 'greets by name').toBeDefined()
    expect(await card.find({ type: 'Text', text: 'missions this week' })).toBeDefined()
    expect(await card.find({ type: 'Text', text: GAME_LABEL }), 'countdown').toBeDefined()
    expect(await card.find({ key: 'stats' })).toBeDefined()
    await card.unmount()
  }

  await $.prompt.submit({ text: 'fix the login callback', wait: false, origin: { kind: 'composer' } })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Wanted' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: '$3.42' })).toBeDefined()
  const pictures = await band.findAll({ type: 'Svg' })
  expect(pictures.every(svg => !String(svg.props.source).includes('<text')), 'meters hold no words').toBe(true)
  await band.unmount()
})

test('the terminal card draws a pixel sunset and the stats in text', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/home/user/vice-code', surface: 'terminal', isInteractive: true })
  const card = await $.ui.mount({ ...row(eng.placed[0] ?? ''), surface: 'terminal' })
  expect(await card.find({ type: 'Raster' })).toBeDefined()
  expect(await card.find({ type: 'Text', text: 'Vice Code' })).toBeDefined()
  expect(await card.find({ type: 'Text', text: GAME_LABEL })).toBeDefined()
  expect(await card.find({ type: 'Text', text: /\/vice radio/ }), 'commands, since a row has no hotkeys').toBeDefined()
  await card.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /Health/ })).toBeDefined()
  await band.unmount()
})

test('a resumed session gets the HUD and no welcome card', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { turnsSoFar: 3 })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.placed).toHaveLength(0)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Health' })).toBeDefined()
  await ui.unmount()
})

test('the spinner speaks Miami and leaves engine messages alone', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  const row = await ui.find({ type: 'Text', text: /^spin:/ })
  expect(row?.text).not.toBe('spin:Sauteing')
  await ui.unmount()

  const busy = await $.ui.mount({ ...SPINNER, surface: 'terminal', props: { ...SPINNER.props, message: 'Compacting' } })
  expect((await busy.find({ type: 'Text', text: /^spin:/ }))?.text).toBe('spin:Sauteing')
  await busy.unmount()
})

test('tool rows carry gear labels', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const props = { tool_use_id: 'tu1', tool: 'Bash', input: { command: 'npm test' }, isRunning: false, isErrored: false, isInterrupted: false }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'vice-code', component: 'ToolUse', requestId: 'tu1', props, surface })
    expect(await ui.find({ type: 'Text', text: /SHOTGUN/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
    await ui.unmount()
  }
})

test('edits and new files count as stolen lines in this session', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'refactor', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Edit', file_path: '/x.ts', old_string: 'b', new_string: 'c\nd' })
  await $.tool.call({ tool: 'Write', file_path: '/x/new.ts', content: 'a\nb\nc' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /This session/ })).toBeDefined()
    // Edit: +2 −1; the new file: +3.
    expect(await ui.find({ text: /\+5 \/ −1/ })).toBeDefined()
    await ui.unmount()
  }
})

test('/vice opens the stats pane, /vice card places the card again, /vice backdrop toggles the sunset', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const opened = await $.command.run({ command: 'vice', args: '', ...COMMAND })
  expect(opened.text).toContain('stats')
  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  const shown = await $.command.run({ command: 'vice', args: 'card', ...COMMAND })
  expect(shown.text).toContain('card')
  expect(eng.placed.filter(id => id.startsWith('welcome-'))).toHaveLength(2)
  // The backdrop is set once at the start; the command clears it and sets it again.
  expect(eng.themes).toEqual(['sunset'])
  expect((await $.command.run({ command: 'vice', args: 'backdrop', ...COMMAND })).text).toContain('is off')
  expect((await $.command.run({ command: 'vice', args: 'backdrop', ...COMMAND })).text).toContain('is on')
  // With the scene off the look is cleared and sent again as its colors alone
  // (an engine from before the colors gets the clear and nothing after it).
  expect(eng.themes.filter(t => t !== 'colors')).toEqual(['sunset', 'clear', 'sunset'])
  const help = await $.command.run({ command: 'vice', args: 'what', ...COMMAND })
  expect(help.text).toContain('/vice import full')
})

test('the radio stops by itself where there is no audio player', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const clock = stubEngine(on, { audioResolvesAtOnce: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const reply = await $.command.run({ command: 'vice', args: 'radio', ...COMMAND })
  expect(reply.text).toContain('on air')
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ key: 'radio' }))?.text, 'radio button').toContain('Play')
  await pane.unmount()
})

test('the history import counts past sessions and skips the live one', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const clock = stubEngine(on, { withHistory: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  await clock.settle()
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Missions passed/ }), 'missions row').toBeDefined()
    // $12.50 from the transcript plus $3.42 spent in this session.
    expect(await ui.find({ text: /\$15\.92/ }), 'money row').toBeDefined()
    expect(await ui.find({ text: /\+1,500/ }), 'lines row').toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-rap' })
  // From the transcript: one bust, three medkits, one stalled ride.
  expect(await ui.find({ text: /Medkits used\s*3/ }), 'medkits from history').toBeDefined()
  await ui.press({ key: 'tab-arsenal' })
  expect(await ui.find({ text: /SHOTGUN · Bash/ }), 'arsenal tab').toBeDefined()
  await ui.press({ key: 'tab-map' })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.map(svg => String(svg.props.alt)).join(' | '), 'turf map').toContain('demo-app')
  await ui.unmount()
})

test('auto language switches to Russian on a Cyrillic prompt', { options: { mode: 'full' } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // The desktop app sends what the person typed through the SDK.
  await $.prompt.submit({ text: 'почини логин', wait: false, origin: { kind: 'sdk' } })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Здоровье' })).toBeDefined()
  await ui.unmount()
})

test('transcript parsing skips lines copied from a parent session and merges chunks', async () => {
  const own = '{"type":"assistant","sessionId":"me","timestamp":"2026-10-20T10:00:00Z","message":{"model":"claude-opus-5-5","id":"msg_1","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}}'
  const copied = '{"type":"assistant","sessionId":"parent","timestamp":"2026-10-19T10:00:00Z","message":{"model":"claude-opus-5-5","id":"msg_0","usage":{"input_tokens":99,"output_tokens":99,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}}'
  const s = summarizeText(`${copied}\n${own}\n`, 'me')
  expect(s.n).toBe(1)
  expect(s.i).toBe(10)
  const both = mergeSummaries(s, summarizeText(`${copied}\n`, ''))
  expect(both.n).toBe(2)
  expect(both.t0).toBeLessThan(s.t0)
})

test('numbers round before they pick a unit', async () => {
  expect(fmtCompact(999_950, 'en')).toBe('1M')
  expect(fmtCompact(4_200_000, 'ru')).toBe('4,2 млн')
  expect(fmtMoney(3.999, 'en')).toBe('$4.00')
})

// ---------- the wanted system ----------

const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString()

test('the five-hour window shows as stars, announced once per level', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 80, resetsAt: inHours(1.5) }, { kind: 'seven_day', percentUsed: 76, resetsAt: inHours(70) }]
  await measure($, eng.usage)
  await measure($, eng.usage)
  const starToasts = eng.toasts.filter(t => t.startsWith('★★★'))
  expect(starToasts).toHaveLength(1)
  expect(starToasts[0]).toContain('Chopper overhead')
  expect(eng.toasts.some(t => t.includes('/model sonnet')), 'swap-ride tip for an Opus').toBe(true)
  expect(eng.toasts.some(t => t.startsWith('Armor is cracking')), 'armor at 75%').toBe(true)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const hud = await band.find({ type: 'Svg' })
  expect(String(hud?.props.alt)).toBe('★★★☆☆')
  expect(String(hud?.props.source), 'a new level flashes').toContain('class="sr"')
  expect(hud?.props.isInteractive).toBe(true)
  expect(await band.find({ type: 'Text', text: 'resets in 1h 30m' })).toBeDefined()
  // The lights stop by themselves: a siren that never ends is noise.
  await eng.advance(20_000)
  await eng.settle()
  const later = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await later.find({ type: 'Svg' }))?.props.source), 'still after a few seconds').not.toContain('class="sr"')
  await later.unmount()
  await band.unmount()
  const mode = await $.ui.mount({ plugin: 'vice-code', component: 'SessionMode', props: { modes: ['plan'] }, surface: 'desktop' })
  expect(await mode.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await mode.unmount()
})

test('a used-up window is busted until it resets, then you are released', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(1) }]
  await measure($, eng.usage)
  // The bust stands in the conversation, where Claude went quiet, and as one line above the prompt.
  const bust = eng.placed.find(id => id.startsWith('busted-')) ?? ''
  const card = await $.ui.mount({ ...row(bust), surface: 'desktop' })
  const banner = await card.find({ type: 'Svg' })
  expect(String(banner?.props.source), 'the word is set in tiles').toContain('class="kx"')
  expect(String(banner?.props.source), 'the address rides on the picture').toContain('github.com/RebSem/vice-code')
  expect(String(banner?.props.alt)).toContain('5-hour limit is used up')
  expect(await card.find({ type: 'Text', text: /Out at 19:30/ })).toBeDefined()
  await card.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Busted' })).toBeDefined()
  await band.unmount()
  // The engine drops the window once its reset passes; the mod's own alarm notices.
  eng.usage.limits = []
  await eng.advance(3_600_000 + 10_000)
  await eng.settle()
  expect(eng.toasts.some(t => t.startsWith('You are out'))).toBe(true)
  const after = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await after.find({ type: 'Text', text: 'Health' })).toBeDefined()
  await after.unmount()
  // The old row stays in the conversation as one quiet line.
  const old = await $.ui.mount({ ...row(bust), surface: 'desktop' })
  expect(await old.find({ type: 'Svg' })).toBeUndefined()
  expect(await old.find({ type: 'Text', text: /You are out/ })).toBeDefined()
  await old.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'tab-rap' })
  expect(await pane.find({ text: /Busted/ })).toBeDefined()
  await pane.unmount()
})

test('a turn that dies short of a full window is a stalled ride, a full window makes it a bust', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  // At 92% nothing says the window was the reason: an overload ends a turn the same way.
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 92, resetsAt: inHours(2) }]
  await failTurn($, 't1')
  expect(eng.toasts.filter(t => t.startsWith('Your ride stalled')), 'a stalled ride').toHaveLength(1)
  expect(eng.placed.some(id => id.startsWith('busted-')), 'no bust on a guess').toBe(false)
  const calm = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await calm.find({ type: 'Text', text: 'Busted' })).toBeUndefined()
  await calm.unmount()
  // A turn that died at once never reached the API's retries: neither a bust nor a stall.
  await failTurn($, 't2', 400)
  expect(eng.toasts.filter(t => t.startsWith('Your ride stalled')), 'an instant error says nothing').toHaveLength(1)
  // The same error after steps that worked is still an error.
  await failTurn($, 't3', 9000, { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 })
  expect(eng.toasts.filter(t => t.startsWith('Your ride stalled')), 'usage from earlier steps hides nothing').toHaveLength(2)
  // The window is full: the error is the limit, with a time to get out.
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(2) }]
  await failTurn($, 't4')
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'Busted' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Out at 20:30/ })).toBeDefined()
  expect(await band.find({ key: 'stats' }), 'buttons stay on the busted line').toBeDefined()
  await band.unmount()
  const card = await $.ui.mount({ ...row(eng.placed.find(id => id.startsWith('busted-')) ?? ''), surface: 'terminal' })
  expect(await card.find({ type: 'Text', text: /BUSTED/ }), 'the loud word, once, in the conversation').toBeDefined()
  await card.unmount()
  expect(eng.toasts.filter(t => t.startsWith('Your ride stalled')), 'a bust is no stall').toHaveLength(2)
})

test('a window that resets after three stars is an escape', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 82, resetsAt: inHours(1) }]
  await measure($, eng.usage)
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 4, resetsAt: inHours(6) }]
  await measure($, eng.usage)
  expect(eng.toasts.some(t => t.startsWith('You got away'))).toBe(true)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-rap' })
  expect(await pane.find({ text: /Got away/ })).toBeDefined()
  expect(await pane.find({ text: /★★★☆☆/ }), 'most wanted').toBeDefined()
  await pane.unmount()
})

test('a compaction is a medkit and low health warns once', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  eng.usage.tokens = 150_000
  await measure($, eng.usage)
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t.startsWith('Health running low'))).toHaveLength(1)
  // The mod's tier hears no compaction: the context dropping by more than 40% between two readings is one.
  const MEDKIT = 'Medkit: 150K → 42K tokens.'
  eng.usage.tokens = 42_000
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t === MEDKIT)).toHaveLength(1)
  // A small drop is the context moving, not a medkit.
  eng.usage.tokens = 30_000
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t.startsWith('Medkit:'))).toHaveLength(1)
  // Health was warned again after the medkit, once.
  eng.usage.tokens = 150_000
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t.startsWith('Health running low'))).toHaveLength(2)
  eng.usage.tokens = 42_000
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t === MEDKIT)).toHaveLength(2)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'tab-rap' })
  expect(await pane.find({ text: /Medkits used\s*2/ })).toBeDefined()
  await pane.unmount()
})

test('no medkit on the first reading of a conversation, after /clear included', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  eng.usage.tokens = 150_000
  await measure($, eng.usage)
  // The next conversation starts small: that is no drop.
  await clearTo($, eng, 'next-session')
  eng.usage.tokens = 20_000
  await measure($, eng.usage)
  expect(eng.toasts.some(t => t.startsWith('Medkit:'))).toBe(false)
  // Even a reading that comes before the mod saw the new id compares with nothing of the old one.
  eng.usage.tokens = 150_000
  await measure($, eng.usage)
  await $.session.end({ reason: 'clear', sessionId: eng.world.sessionId } as never)
  eng.usage.tokens = 20_000
  await measure($, eng.usage)
  expect(eng.toasts.some(t => t.startsWith('Medkit:'))).toBe(false)
})

test('other mods keep their part of the band', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ type: 'Text', text: /engine/ }), `band below ours on ${surface}`).toBeDefined()
    await band.unmount()
  }
})

test('wanted levels, busts and reset times', async () => {
  expect([0, 39.9, 40, 60, 75, 88, 97, 100].map(p => starsFor(p))).toEqual([0, 0, 1, 2, 3, 4, 5, 5])
  expect(countBusts(['five_hour:1', 'five_hour:1', 't1000', 't1500', 't5000'])).toBe(3)
  expect(fmtLeft(83 * 60_000, 'en')).toBe('1h 23m')
  expect(fmtLeft(12 * 60_000, 'ru')).toBe('12\u00a0мин')
  expect(fmtLeft(52 * 3_600_000, 'en')).toBe('2d 4h')
  expect(rejectedBy({ short: { pct: 99, resetsAt: NOW }, week: { pct: 40, resetsAt: NOW + 1 }, spend: null })).toEqual({ kind: 'short', until: NOW })
  expect(rejectedBy({ short: { pct: 50, resetsAt: NOW }, week: null, spend: null })).toEqual({ kind: 'hidden', until: null })
  const now = Date.UTC(2026, 9, 27, 12, 0)
  expect(fmtResetAt(now + 3 * 3_600_000, now, 0, 'en')).toBe('at 15:00')
  expect(fmtResetAt(now + 22 * 3_600_000, now, 0, 'ru')).toBe('завтра в 10:00')
})

test('another session\'s memory is folded in, its bust only at start', async () => {
  const here = { ...emptyMemory(), announced: { '100': 1 }, peak: 1, peakKey: '100', tipKey: '' }
  const there = { ...emptyMemory(), announced: { '100': 3 }, peak: 3, peakKey: '100', tipKey: '100', free: ['s100'], busted: { kind: 'hidden' as const, until: null, sticky: true, since: 5 }, bustedKey: '100' }
  const m = mergeMemory(here, there, false)
  expect(m.announced['100']).toBe(3)
  expect(m.peak).toBe(3)
  expect(m.tipKey).toBe('100')
  expect(m.free).toEqual(['s100'])
  expect(m.busted, 'no bust taken mid-session').toBe(null)
  expect(m.bustedKey, 'but waiting that window out is no escape').toBe('100')
  expect(mergeMemory(here, there, true).busted?.kind).toBe('hidden')
  // A newer window elsewhere wins; an older one does not drag this session back.
  expect(mergeMemory({ ...here, peakKey: '200', peak: 2 }, there, false)).toMatchObject({ peakKey: '200', peak: 2 })
  expect(mergeMemory(here, { announced: { '100': 'x' as never } }, false).announced['100'], 'junk from an old store is ignored').toBe(1)
  // A window that ended somewhere does not come back from a stale copy, and its heat is gone.
  const ended = mergeMemory({ ...here, peakKey: '200', peak: 1, closed: ['100'] }, there, false)
  expect(ended).toMatchObject({ peakKey: '200', peak: 1, closed: ['100'] })
  expect(mergeMemory({ ...here, peak: 4 }, { closed: ['100'], peakKey: 'none' }, false)).toMatchObject({ peakKey: 'none', peak: 0 })
})

const windowAt = (h: number) => String(Math.round((NOW + h * 3_600_000) / 60_000))

test('an escape is counted once even when several sessions see the window end', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  // Another session already counted the end of this window.
  const eng = stubEngine(on, { store: { records: { escapes: 1, maxStars: 3, escapedKey: windowAt(1) } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 82, resetsAt: inHours(1) }]
  await measure($, eng.usage)
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 4, resetsAt: inHours(6) }]
  await measure($, eng.usage)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-rap' })
  expect(await pane.find({ text: /Got away\s+1\b/ })).toBeDefined()
  await pane.unmount()
})

test('a new session does not wear a bust whose reset time has passed', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const old = { ...emptyMemory(), busted: { kind: 'short', until: NOW - 20 * 3_600_000, since: NOW - 21 * 3_600_000 }, bustedKey: 'old' }
  const eng = stubEngine(on, { store: { wanted: old } })
  eng.usage.limits = []
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.placed.some(id => id.startsWith('busted-')), 'no busted card').toBe(false)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'Busted' })).toBeUndefined()
  await band.unmount()
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 10, resetsAt: inHours(4) }]
  await measure($, eng.usage)
  expect(eng.toasts.some(t => t.startsWith('You are out')), 'no stray release toast').toBe(false)
})

test('the radio and effects are synthesized WAVs', async () => {
  for (const name of ['medkit', 'siren'] as const) expect(sound(name).startsWith('UklGR')).toBe(true)
})

test('a turn rejected on credit is a bust that holds until an answer comes back', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  // Past 100% and still answering: extra usage, no bust.
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(2) }]
  await $.turn.start({ text: 'go', turnId: 't1' })
  await measure($, eng.usage)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  await eng.advance(60_000)
  await $.turn.start({ text: 'more', turnId: 't2' })
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' })
  expect(eng.toasts.some(t => t.includes('on credit'))).toBe(true)
  // Then a turn is rejected: the credit ran out. No reading says so, so the bust is held.
  await failTurn($, 't3')
  await measure($, eng.usage)
  const held = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await held.find({ type: 'Text', text: 'Busted' }), 'still busted after a reading that shows nothing new').toBeDefined()
  await held.unmount()
  expect(eng.toasts.some(t => t.startsWith('Your ride stalled')), 'a bust is no stall').toBe(false)
  // The next turn gets an answer: the limit no longer blocks.
  await eng.advance(60_000)
  await $.turn.start({ text: 'again', turnId: 't9' })
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't9', reason: 'answer' })
  expect(eng.toasts.some(t => t.startsWith('You are out'))).toBe(true)
})

test('extra usage past 100% is not a bust once Claude keeps answering', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(1) }]
  await $.turn.start({ text: 'go', turnId: 't1' })
  await measure($, eng.usage)
  // The turn that hit 100% still answers: that alone proves nothing.
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(eng.toasts.some(t => t.includes('on credit'))).toBe(false)
  await eng.advance(60_000)
  await $.turn.start({ text: 'more', turnId: 't2' })
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' })
  expect(eng.toasts.some(t => t.includes('on credit'))).toBe(true)
  await measure($, eng.usage)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = await band.find({ type: 'Svg' })
  expect(String(svg?.props.alt)).toBe('★★★★★')
  await band.unmount()
})

test('a 429 and the measure it causes count as one bust', { options: { mode: 'full', language: 'en', sounds: true } }, async ($, on) => {
  const eng = stubEngine(on, { audioResolvesAtOnce: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(1) }]
  await $.turn.start({ text: 'go', turnId: 't1' })
  await Promise.all([$.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'error' }), measure($, eng.usage)])
  expect(eng.plays.filter(p => p === 1), 'one siren').toHaveLength(1)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-rap' })
  expect(await pane.find({ text: /Busted\s+1\b/ })).toBeDefined()
  await pane.unmount()
})

test('/clear keeps the wanted memory: no second announcement for the same level', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 80, resetsAt: inHours(1.5) }]
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t.startsWith('★★★'))).toHaveLength(1)
  await clearTo($, eng, 'next-session')
  await measure($, eng.usage)
  expect(eng.toasts.filter(t => t.startsWith('★★★'))).toHaveLength(1)
})

// ---------- fitting in ----------

test('a run nobody watches gets no card, no import and no HUD', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { withHistory: true, surfaces: [] })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await eng.advance(5000)
  await eng.settle()
  await $.prompt.submit({ text: 'run the nightly job', wait: false, origin: { kind: 'sdk' } })
  expect(eng.placed).toHaveLength(0)
  expect(eng.themes).toHaveLength(0)
  expect(eng.toasts).toHaveLength(0)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /Health/ })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await band.unmount()
})

test('an engine too old gets one line about updating and nothing else', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { engine: '2.1.300' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.toasts).toHaveLength(1)
  expect(eng.toasts[0]).toContain('claude update')
  expect(eng.placed).toHaveLength(0)
  expect(isTooOld('2.1.318')).toBe(true)
  expect(isTooOld('2.1.319')).toBe(false)
  expect(isTooOld('2.2.0')).toBe(false)
  expect(isTooOld(undefined), 'a build that does not say is given a try').toBe(false)
})

test('the HUD can be turned off and still says why Claude is quiet', { options: { mode: 'full', language: 'en', hud: 'off' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const quiet = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await quiet.find({ type: 'Text', text: 'Health' })).toBeUndefined()
  await quiet.unmount()
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(1) }]
  await measure($, eng.usage)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Busted' })).toBeDefined()
  await band.unmount()
})

test('compact keeps the wanted level and drops the meters', { options: { mode: 'full', language: 'en', hud: 'compact' } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /☆☆☆☆☆/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Health/ })).toBeUndefined()
  await band.unmount()
})

test('the sunset backdrop draws where a surface has one and leaves other mods alone', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.themes).toEqual(['sunset'])
  const glass = { blur: 24, opacity: 0.72 }
  for (const surface of ['desktop', 'mobile'] as const) {
    const ours = await $.ui.mount({ plugin: 'vice-code', component: 'Backdrop', props: { scene: 'sunset', plugin: 'vice-code', glass }, surface })
    expect(await ours.find({ type: 'Svg' }), surface).toBeDefined()
    await ours.unmount()
  }
  const theirs = await $.ui.mount({ plugin: 'vice-code', component: 'Backdrop', props: { scene: 'lagoon', plugin: 'another-mod', glass }, surface: 'desktop' })
  expect(await theirs.find({ type: 'Svg' })).toBeUndefined()
  await theirs.unmount()
})

test('the backdrop setting turns it off', { options: { mode: 'full', language: 'en', backdrop: false } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.themes.filter(t => t !== 'colors'), 'no scene; the colors stay where an engine has them').toHaveLength(0)
  // With no scene behind the conversation the welcome card brings its own banner.
  const card = await $.ui.mount({ ...row(eng.placed[0] ?? ''), surface: 'desktop' })
  expect(await card.find({ type: 'Svg' })).toBeDefined()
  await card.unmount()
})

test('pictures hold no words, and meters take the tone of what is left', async () => {
  expect(toneFor(80)).toBe('ok')
  expect(toneFor(40)).toBe('warn')
  expect(toneFor(10)).toBe('bad')
  expect(meterSvg(62)).not.toContain('<text')
  expect(starsSvg(3, 'flash')).toContain('class="sr"')
  expect(starsSvg(3, 'still')).not.toContain('class="sr"')
  expect(starsSvg(2, 'flash'), 'only a hot level flashes').not.toContain('class="sr"')
  expect(starsSvg(4, 'fade')).toContain('class="bl"')
  const banner = bustedSvg('BUSTED', 'github.com/x/y', false)
  expect(banner, 'the word is set in tiles').toContain('class="kx"')
  expect(banner).not.toContain('class="lr"')
  expect(bustedSvg('ПОВЯЗАЛИ', '', true)).toContain('class="lr"')
  expect(bustedSvg('ZZZ', '', false), 'a word outside the face falls back to text').toContain('>ZZZ<')
  expect(banner.length).toBeLessThan(131_072)
  expect(bustedRowId({ since: 42 })).toBe('busted-42')
})

test('every scene fits its limit, follows the window and rests when asked', async () => {
  const auto = backdropSvg('sunset', 'auto', 0, false)
  expect(auto, 'light paper in a light window').toContain('prefers-color-scheme:light')
  expect(backdropSvg('sunset', 'dark', 0, false)).not.toContain('prefers-color-scheme')
  expect(auto, 'rests when motion is reduced').toContain('prefers-reduced-motion')
  expect(auto, 'no blurs').not.toContain('feGaussianBlur')
  expect(auto, 'the backdrop never takes the pointer, so it carries no hover rules').not.toContain(':hover')
  expect(auto, 'held by its foot when the window crops it').toContain('preserveAspectRatio="xMidYMax slice"')
  // Every animation moves in steps: the picture is painted a few times a second at most.
  const timings = auto.match(/animation:[^;}]+/g) ?? []
  expect(timings.length).toBeGreaterThan(0)
  expect(timings.filter(t => !t.includes('steps(') && !t.includes('none')), 'nothing eases').toEqual([])
  // The wanted level lives in the picture: patrol lights from three stars, a helicopter from four.
  const has = (svg: string, name: string) => new RegExp(`class="[^"]*\\b${name}\\b`).test(svg)
  expect(has(backdropSvg('sunset', 'auto', 2, false), 'kr')).toBe(false)
  expect(has(backdropSvg('sunset', 'auto', 3, false), 'kr')).toBe(true)
  expect(has(backdropSvg('sunset', 'auto', 3, false), 'heli')).toBe(false)
  expect(has(backdropSvg('sunset', 'auto', 4, false), 'heli')).toBe(true)
  expect(has(backdropSvg('sunset', 'auto', 3, true), 'cr'), 'new heat blinks').toBe(true)
  expect(has(backdropSvg('sunset', 'auto', 3, false), 'cr')).toBe(false)
  for (const tod of ['dawn', 'day', 'sunset', 'night'] as const) {
    for (const stock of ['auto', 'light', 'dark'] as const) {
      expect(backdropSvg(tod, stock, 5, true).length, `${tod} ${stock} backdrop fits`).toBeLessThan(131_072)
      expect(stripSvg(tod, stock).length, `${tod} ${stock} banner fits`).toBeLessThan(131_072)
    }
  }
  expect(backdropSvg('sunset', 'auto', 5, true), 'the same picture every time').toBe(backdropSvg('sunset', 'auto', 5, true))
  const px = scenePixels('sunset', 36, 16)
  expect(px).toHaveLength(16)
  expect(px[0]).toHaveLength(36)
})

test('the backdrop shows the wanted level', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const target = { plugin: 'vice-code', component: 'Backdrop', props: { scene: 'sunset', plugin: 'vice-code', glass: { blur: 10, opacity: 0.5 } }, surface: 'desktop' } as const
  const calm = await $.ui.mount(target)
  const quiet = await calm.find({ type: 'Svg' })
  expect(quiet?.props.isInteractive, 'so its own CSS animates it').toBe(true)
  expect(String(quiet?.props.source)).not.toMatch(/class="[^"]*\bheli\b/)
  await calm.unmount()
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 92, resetsAt: inHours(1) }]
  await measure($, eng.usage)
  const hot = await $.ui.mount(target)
  expect(String((await hot.find({ type: 'Svg' }))?.props.source), 'a helicopter at four stars').toMatch(/class="[^"]*\bheli\b/)
  await hot.unmount()
})

// ---------- Lite: the look alone ----------


const BACKDROP = { plugin: 'vice-code', component: 'Backdrop', props: { scene: 'sunset', plugin: 'vice-code', glass: { blur: 12, opacity: 0.55 } }, surface: 'desktop' } as const
const TOOL = { tool_use_id: 'tu1', tool: 'Bash', input: { command: 'npm test' }, isRunning: false, isErrored: false, isInterrupted: false }

test('Lite is the default: the look and one hello card, and nothing of the game', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { withHistory: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await eng.advance(5000)
  await eng.settle()
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed).toHaveLength(1)
  const hello = eng.placed[0] ?? ''
  expect(hello.startsWith('hello-')).toBe(true)
  // Nothing is read from the history and nobody's name is asked: the time zone is all.
  expect(eng.runs.filter(r => r !== 'date')).toEqual([])
  expect(eng.toasts).toHaveLength(0)

  const card = await $.ui.mount({ ...row(hello), surface: 'desktop' })
  expect(await card.find({ type: 'Text', text: 'Welcome to Miami.' })).toBeDefined()
  expect(await card.find({ type: 'Text', text: GAME_LABEL }), 'countdown').toBeDefined()
  expect(await card.find({ type: 'Text', text: /unofficial fan mod/ }), 'says what it is').toBeDefined()
  expect(await card.find({ key: 'game' }), 'a way into the game').toBeDefined()
  const picture = await card.find({ type: 'Svg' })
  expect(picture?.props.isInteractive, 'the sky in the card feels the pointer').toBe(true)
  expect(String(picture?.props.source)).toContain('.b:hover')
  await card.unmount()

  await $.prompt.submit({ text: 'fix the login callback', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await measure($, { ...eng.usage, limits: [{ kind: 'five_hour', percentUsed: 99, resetsAt: inHours(1) }] })
  expect(eng.toasts, 'no wanted level in Lite').toHaveLength(0)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ type: 'Text', text: /Health/ }), surface).toBeUndefined()
    expect(await band.find({ type: 'Text', text: /engine/ }), surface).toBeDefined()
    await band.unmount()
    const tool = await $.ui.mount({ plugin: 'vice-code', component: 'ToolUse', requestId: 'tu1', props: TOOL, surface })
    expect(await tool.find({ type: 'Text', text: /SHOTGUN/ }), surface).toBeUndefined()
    await tool.unmount()
  }
  const spinner = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect((await spinner.find({ type: 'Text', text: /^spin:/ }))?.text).toBe('spin:Sauteing')
  await spinner.unmount()
  // The scene stays calm whatever the limits say.
  const scene = await $.ui.mount(BACKDROP)
  const sky = String((await scene.find({ type: 'Svg' }))?.props.source)
  expect(sky).toContain('class="sky"')
  expect(sky).not.toContain('class="heli"')
  await scene.unmount()
})

test('where the scene is drawn the hello card comes once', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { welcomed: 1 } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed).toHaveLength(0)
  // It can still be asked for.
  await $.command.run({ command: 'vice', args: 'card', ...COMMAND })
  expect(eng.placed).toHaveLength(1)
})

test('in a terminal Lite is a banner at the top of each new conversation', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { welcomed: 1 }, surfaces: ['terminal'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.placed).toHaveLength(1)
  const card = await $.ui.mount({ ...row(eng.placed[0] ?? ''), surface: 'terminal' })
  expect(await card.find({ type: 'Raster' })).toBeDefined()
  expect(await card.find({ type: 'Text', text: 'Welcome to Miami.' })).toBeDefined()
  expect(await card.find({ type: 'Text', text: /\/vice full/ }), 'how to turn the game on').toBeDefined()
  await card.unmount()
  // /clear opens another conversation, with its own banner.
  await clearTo($, eng, 'next-session')
  expect(eng.placed).toHaveLength(2)
})

test('a resumed conversation gets the look and no card', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { turnsSoFar: 4, surfaces: ['terminal'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed).toHaveLength(0)
})

test('a window that attaches after the start gets the look and the card then', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { surfaces: [], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: null, isInteractive: true })
  expect(eng.placed, 'nobody to greet yet').toHaveLength(0)
  eng.world.surfaces = ['desktop']
  eng.world.isLookDrawn = true
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  expect(eng.themes).toEqual(['sunset', 'sunset'])
  expect(eng.placed).toHaveLength(1)
  // A second window changes nothing.
  await $.session.attach({ surface: 'mobile', clientId: 'mobile:default' })
  expect(eng.placed).toHaveLength(1)
})

test('/vice full turns the game on and /vice lite turns it off', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect((await $.command.run({ command: 'vice', args: 'stats', ...COMMAND })).text).toContain('/vice full')
  expect((await $.command.run({ command: 'vice', args: '', ...COMMAND })).text, 'Lite has its own help').toContain('/vice off')
  expect((await $.command.run({ command: 'vice', args: 'full', ...COMMAND })).text).toContain('Game on')
  expect(eng.placed.filter(id => id.startsWith('welcome-')), 'the game opens with its stats card').toHaveLength(1)
  expect(eng.toasts.some(t => t.includes('stars are the 5-hour limit')), 'the legend, once').toBe(true)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  expect((await $.command.run({ command: 'vice', args: 'full', ...COMMAND })).text).toContain('already')

  expect((await $.command.run({ command: 'vice', args: 'lite', ...COMMAND })).text).toContain('Lite')
  expect(await band.find({ type: 'Text', text: 'Health' }), 'the band empties without a new mount').toBeUndefined()
  await band.unmount()
  // The game's card stays what it was; Lite's stays Lite's.
  const hello = await $.ui.mount({ ...row(eng.placed.find(id => id.startsWith('hello-')) ?? ''), surface: 'desktop' })
  expect(await hello.find({ type: 'Text', text: 'Welcome to Miami.' })).toBeDefined()
  await hello.unmount()
})

test('the card button turns the game on', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const card = await $.ui.mount({ ...row(eng.placed[0] ?? ''), surface: 'desktop' })
  await card.press({ key: 'game' })
  await eng.settle()
  await card.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  await band.unmount()
})

test('a choice made with /vice holds across sessions', { options: { language: 'en' } }, async ($, on) => {
  // An earlier session ran /vice full while the setting said lite.
  stubEngine(on, { store: { mode: { v: 'full', over: 'lite' } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  await band.unmount()
})

test('a setting changed after the choice wins over it', { options: { language: 'en', paper: 'light' } }, async ($, on) => {
  // /vice paper dark was said while the setting was auto; the setting is light now.
  stubEngine(on, { store: { paper: { v: 'dark', over: 'auto' } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const scene = await $.ui.mount(BACKDROP)
  const sky = String((await scene.find({ type: 'Svg' }))?.props.source)
  expect(sky, 'light paper').toContain('--s0:#f3e6e4')
  expect(sky).not.toContain('prefers-color-scheme')
  await scene.unmount()
})

test('/vice paper picks the stock by hand', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const scene = await $.ui.mount(BACKDROP)
  expect(String((await scene.find({ type: 'Svg' }))?.props.source), 'follows the window').toContain('prefers-color-scheme:light')
  expect((await $.command.run({ command: 'vice', args: 'paper dark', ...COMMAND })).text).toContain('dark stock')
  const dark = String((await scene.find({ type: 'Svg' }))?.props.source)
  expect(dark, 'redrawn in place').not.toContain('prefers-color-scheme')
  expect(dark).toContain('--s0:#140e22')
  await scene.unmount()
  expect(eng.themes, 'the look is sent again').toEqual(['sunset', 'sunset'])
  // Both modes of the colors still go, and the window is not asked to change its own:
  // the paper changes the scene alone. (An engine from before the colors sees none of them.)
  expect(eng.modes.length === 0 || eng.modes.length === 2, 'every look carried the colors, or none could').toBe(true)
  expect(eng.modes.every(m => m === 'dark+light')).toBe(true)
  expect(eng.overrides).toHaveLength(0)
  expect((await $.command.run({ command: 'vice', args: 'paper', ...COMMAND })).text).toContain('/vice paper auto')
})

test('/vice off clears the look and steps aside until /vice on', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  expect((await $.command.run({ command: 'vice', args: 'off', ...COMMAND })).text).toContain('/vice on')
  expect(eng.themes).toEqual(['sunset', 'clear'])
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect((await $.command.run({ command: 'vice', args: 'stats', ...COMMAND })).text, 'only /vice on is heard').toContain('/vice on')
  const toasts = eng.toasts.length
  await measure($, { ...eng.usage, limits: [{ kind: 'five_hour', percentUsed: 99, resetsAt: inHours(1) }] })
  expect(eng.toasts).toHaveLength(toasts)

  expect((await $.command.run({ command: 'vice', args: 'on', ...COMMAND })).text).toContain('back on')
  expect(eng.themes).toEqual(['sunset', 'clear', 'sunset'])
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  await band.unmount()
})

test('a mod that was turned off stays off in the next session', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { off: true } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.themes).toHaveLength(0)
  expect(eng.placed).toHaveLength(0)
  expect((await $.command.run({ command: 'vice', args: 'on', ...COMMAND })).text).toContain('back on')
  expect(eng.themes).toEqual(['sunset'])
})

test('an engine from before the colors still gets the scene', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { refusesColors: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.themes).toEqual(['sunset'])
})

test('Lite greets in the language of the last session', async ($, on) => {
  const eng = stubEngine(on, { store: { lang: 'ru' } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const card = await $.ui.mount({ ...row(eng.placed[0] ?? ''), surface: 'desktop' })
  expect(await card.find({ type: 'Text', text: 'Добро пожаловать в Майами.' })).toBeDefined()
  await card.unmount()
})

test('a run nobody watches gets no look either', async ($, on) => {
  const eng = stubEngine(on, { surfaces: [] })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.prompt.submit({ text: 'run the nightly job', wait: false, origin: { kind: 'sdk' } })
  await $.turn.start({ text: 'go', turnId: 't1' })
  expect(eng.themes).toHaveLength(0)
  expect(eng.placed).toHaveLength(0)
  expect(eng.runs).toHaveLength(0)
})

// The desktop and mobile apps drive the engine as a program does: the session starts with
// nobody at it, and the app's window attaches a moment later.
test('an app session wakes the mod when its window attaches', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { surfaces: [] })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(eng.themes).toHaveLength(0)
  eng.world.surfaces = ['desktop']
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(1)
  expect((await $.command.run({ command: 'vice', args: 'full', ...COMMAND })).text).toContain('Game on')
  // What the person types in the app arrives through the SDK and counts as theirs.
  await $.prompt.submit({ text: 'fix the login callback', wait: false, origin: { kind: 'sdk' } })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeDefined()
  await band.unmount()
  // A second window does not set the mod up again.
  await $.session.attach({ surface: 'mobile', clientId: 'mobile:default' })
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(1)
})

test('an app session whose window is already there starts at once', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { surfaces: ['desktop'] })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed.filter(id => id.startsWith('welcome-'))).toHaveLength(1)
})

test('the look gives both modes and the desktop paints it', async () => {
  expect(unpainted()).toBeUndefined()
  expect(Object.keys(look().colors.inputs).sort()).toEqual(['dark', 'light'])
  // The page is the stock the scene prints on, so the picture has no edge.
  expect(JSON.stringify(look().colors.inputs)).toContain(PAGE.dark)
  expect(JSON.stringify(look().colors.inputs)).toContain(PAGE.light)
})

test('a terminal is asked for the look once more, not on every turn', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { surfaces: ['terminal'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const turnId of ['t1', 't2', 't3']) {
    await $.turn.start({ text: 'go', turnId })
    await eng.settle()
  }
  // Once at the start and once at the first turn: another mod's theme is not replaced turn after turn.
  expect(eng.themes).toEqual(['sunset', 'sunset'])
})

test('turning the game off stops a history import that had not begun', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { withHistory: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'vice', args: 'import', ...COMMAND })
  await $.command.run({ command: 'vice', args: 'lite', ...COMMAND })
  const before = eng.toasts.length
  await eng.advance(5000)
  await eng.settle()
  expect(eng.runs.filter(r => r === 'awk'), 'Lite reads no history').toHaveLength(0)
  expect(eng.toasts).toHaveLength(before)
})

test('turning the game back on keeps what the conversation counted', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'refactor', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Edit', file_path: '/x.ts', old_string: 'b', new_string: 'c\nd' })
  await $.command.run({ command: 'vice', args: 'lite', ...COMMAND })
  await $.command.run({ command: 'vice', args: 'full', ...COMMAND })
  expect(eng.placed.filter(id => id.startsWith('welcome-')), 'no second stats card').toHaveLength(1)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await pane.find({ text: /\+2 \/ −1/ }), 'the edit is still counted').toBeDefined()
  await pane.unmount()
})

test('the icon is a still picture with every color written into it', async () => {
  const icon = iconSvg()
  expect(icon).not.toContain('<style')
  expect(icon).not.toContain('var(')
  expect(icon).not.toContain('class=')
})

test('the banner feels the pointer and the backdrop does not', async () => {
  const groups = (svg: string) => (svg.match(/class="b[" ]/g) ?? []).length
  const banner = stripSvg('sunset', 'auto')
  expect(banner).toContain('.b:hover')
  expect(groups(banner), 'a few dozen groups, not hundreds').toBeGreaterThan(8)
  expect(groups(banner)).toBeLessThanOrEqual(48)
  expect(backdropSvg('sunset', 'auto')).not.toContain(':hover')
})

test('a window that joined without saying it draws themes still counts as an app window', { options: { language: 'en' } }, async ($, on) => {
  // The engine answers "not drawn" (nobody declared themes), yet a desktop window is on the roster.
  const eng = stubEngine(on, { surfaces: ['desktop'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed.filter(id => id.startsWith('hello-')), 'the once-after-install card').toHaveLength(1)
  // The next conversation does not get the card again, as in a window that draws the scene.
  await clearTo($, eng, 'next-session')
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(1)
  // And the first turn does not send the look again.
  await $.turn.start({ text: 'go', turnId: 't1' })
  await eng.settle()
  expect(eng.themes).toEqual(['sunset', 'sunset'])
})

test('a dormant mod wakes at the first prompt if a window is there and no attach was heard', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { surfaces: [] })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(eng.themes).toHaveLength(0)
  // A window got onto the roster, but the attach never reached the module.
  eng.world.surfaces = ['desktop']
  await $.prompt.submit({ text: 'fix the login callback', wait: false, origin: { kind: 'sdk' } })
  expect(eng.themes).toEqual(['sunset'])
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(1)
})

test('a terminal with a phone attached keeps its card at the top of each conversation', { options: { language: 'en' } }, async ($, on) => {
  // The phone joined without saying it draws themes; the terminal draws no look at all.
  const eng = stubEngine(on, { store: { welcomed: 1 }, surfaces: ['terminal', 'mobile'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(1)
  await clearTo($, eng, 'next-session')
  expect(eng.placed.filter(id => id.startsWith('hello-')), 'the banner is the look in a terminal').toHaveLength(2)
})

test('a session nobody watches stops looking for a window after a few prompts', async ($, on) => {
  const eng = stubEngine(on, { surfaces: [] })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const atStart = eng.rosterReads()
  for (let i = 0; i < 12; i++) {
    await $.prompt.submit({ text: `job ${i}`, wait: false, origin: { kind: 'sdk' } })
    await $.turn.start({ text: 'go', turnId: `t${i}` })
  }
  expect(eng.rosterReads() - atStart, 'a handful of looks, then none').toBeLessThanOrEqual(5)
  expect(eng.themes).toHaveLength(0)
})

test('the card speaks of the colors only where the engine took them', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { refusesColors: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const card = await $.ui.mount({ ...row(eng.placed[0] ?? ''), surface: 'desktop' })
  expect(await card.find({ type: 'Text', text: /skyline at dusk/ })).toBeDefined()
  expect(await card.find({ type: 'Text', text: /its colors/ }), 'no colors were taken').toBeUndefined()
  await card.unmount()
})

// ---------- the switch above the prompt ----------

test('an app window has a switch above the prompt: Off, Look, Game', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // The position in force carries the dot; all three have the same chrome, and the other two are dim.
  const main = async () => {
    const three = await Promise.all(['mode-off', 'mode-lite', 'mode-full'].map(key => band.find({ key })))
    for (const b of three) expect(b?.props.variant, 'one chrome for all three').toBe('secondary')
    for (const b of three) expect(b?.props.dimColor, 'a dim Button would be tucked into the app\'s menu').toBeUndefined()
    const marked = three.filter(b => String(b?.props.label).startsWith('● '))
    expect(marked, 'one position in force').toHaveLength(1)
    return String(marked[0]?.props.label).slice(2)
  }
  expect(await main(), 'Lite is the position in force').toBe('Look')
  expect((await band.find({ type: 'Text', text: 'Off' }))?.props.dimColor, 'the others are dim').toBe(true)
  const label = await band.find({ type: 'Text', text: 'Vice Code' })
  expect(label?.props.size, 'the label is body text, on the buttons\' line').toBeUndefined()
  expect(await band.find({ type: 'Text', text: /engine/ }), 'other mods keep their rows').toBeDefined()

  await band.press({ key: 'mode-full' })
  await eng.settle()
  expect(await main()).toBe('Game')
  expect(await band.find({ type: 'Text', text: 'Health' }), 'the HUD shares the line with the switch').toBeDefined()

  await band.press({ key: 'mode-off' })
  await eng.settle()
  expect(await main(), 'the switch stays when the mod is off, so it can be turned back on').toBe('Off')
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeUndefined()
  expect(eng.themes.at(-1)).toBe('clear')

  await band.press({ key: 'mode-lite' })
  await eng.settle()
  expect(await main()).toBe('Look')
  expect(eng.themes.at(-1), 'the look is back').toBe('sunset')
  expect(await band.find({ type: 'Text', text: 'Health' }), 'and the game is not').toBeUndefined()
  await band.unmount()

  // A phone gets the same switch; a terminal keeps its band for the game.
  const phone = await $.ui.mount({ ...BAND, surface: 'mobile' })
  expect(await phone.find({ key: 'mode-off' })).toBeDefined()
  await phone.unmount()
  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ key: 'mode-off' })).toBeUndefined()
  await term.unmount()
})

test('the switch can be hidden, by the setting or by /vice switch', { options: { language: 'en', switch: false } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: 'mode-off' }), 'hidden by the setting').toBeUndefined()
  expect((await $.command.run({ command: 'vice', args: 'switch', ...COMMAND })).text).toContain('is shown')
  expect(await band.find({ key: 'mode-off' }), 'shown without a new mount').toBeDefined()
  expect((await $.command.run({ command: 'vice', args: 'switch', ...COMMAND })).text).toContain('is hidden')
  expect(await band.find({ key: 'mode-off' })).toBeUndefined()
  await band.unmount()
})

test('a new conversation is set up once, from the session id changing', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { welcomed: 1 }, surfaces: ['terminal'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.placed).toHaveLength(1)
  // The id has not changed yet: nothing to set up.
  await $.session.end({ reason: 'clear', sessionId: 'live-session' } as never)
  await eng.advance(600)
  await eng.settle()
  expect(eng.placed, 'still the old conversation').toHaveLength(1)
  // The id changes: the watch sees it on its next tick.
  eng.world.sessionId = 'second'
  await eng.advance(200)
  await eng.settle()
  expect(eng.placed, 'the next conversation got its card').toHaveLength(2)
  // Neither the watch, running on, nor the first prompt sets it up again.
  await eng.advance(6000)
  await eng.settle()
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  expect(eng.placed, 'one card for the conversation').toHaveLength(2)
})

test('the first prompt sets a conversation up when the watch missed it, and only once', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { welcomed: 1 }, surfaces: ['terminal'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  // The person types before the watch's first tick: the prompt sets it up, the watch then finds nothing to do.
  await $.session.end({ reason: 'resume', sessionId: 'live-session' } as never)
  eng.world.sessionId = 'second'
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  expect(eng.placed).toHaveLength(2)
  await eng.advance(1000)
  await eng.settle()
  expect(eng.placed, 'one card for the conversation').toHaveLength(2)
  // The id changes only after the watch gave up: the first prompt is the backstop.
  await $.session.end({ reason: 'clear', sessionId: 'second' } as never)
  await eng.advance(6000)
  await eng.settle()
  expect(eng.placed).toHaveLength(2)
  eng.world.sessionId = 'third'
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await eng.advance(1000)
  await eng.settle()
  expect(eng.placed).toHaveLength(3)
})

test('no hook stands on an event an app\'s own plugin can pass by', () => {
  // The engine prints a "hook was skipped" row for each one: none of classic.* or session.compact.
  const events: string[] = []
  const record = (name: string) => {
    events.push(name)
    const chain = { catch: () => chain }
    return chain
  }
  register(record as never, {})
  expect(events).toContain('session.end')
  expect(events.filter(n => n.startsWith('classic.')), 'no classic hook').toEqual([])
  const passedBy = ['session.compact', 'prompt.section', 'prompt.context', 'prompt.attachment', 'prompt.compose', 'skill.prompt', 'attribution.text', 'settings.read']
  expect(events.filter(n => passedBy.includes(n)), 'none of the events the app sends on past a mod').toEqual([])
})

test('Game and then Off pressed in one breath end with the mod off', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // Neither press waits for the other: the changes still run in turn.
  await Promise.all([band.press({ key: 'mode-full' }), band.press({ key: 'mode-off' })])
  await eng.settle()
  expect(eng.themes.at(-1), 'the look is cleared last').toBe('clear')
  expect((await band.find({ key: 'mode-off' }))?.props.label).toBe('● Off')
  expect(await band.find({ type: 'Text', text: 'Health' })).toBeUndefined()
  await band.unmount()
})

test('a mod that starts off still speaks the language and takes the commands that turn it on', { options: { language: 'ru' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { off: true } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ key: 'mode-off' }))?.props.label, 'the switch is in Russian although nothing was set up').toBe('● Выкл')
  // The switch can be hidden and shown while off, and /vice full turns the mod on straight into the game.
  expect((await $.command.run({ command: 'vice', args: 'switch', ...COMMAND })).text).toContain('скрыт')
  expect((await $.command.run({ command: 'vice', args: 'switch', ...COMMAND })).text).toContain('показан')
  expect((await $.command.run({ command: 'vice', args: 'stats', ...COMMAND })).text, 'the rest still waits').toContain('/vice on')
  expect((await $.command.run({ command: 'vice', args: 'full', ...COMMAND })).text).toContain('Игра включена')
  expect(eng.themes).toEqual(['sunset'])
  expect((await band.find({ key: 'mode-full' }))?.props.label).toBe('● Игра')
  await band.unmount()
})

test('after /clear the conversation is new whatever the turn count says; a resumed one is not', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.placed.filter(id => id.startsWith('welcome-'))).toHaveLength(1)
  // The engine counts /clear itself: the new conversation starts with a turn on the clock.
  eng.world.turns = 1
  await clearTo($, eng, 'second-conversation')
  expect(eng.placed.filter(id => id.startsWith('welcome-')), 'a card for the cleared conversation').toHaveLength(2)
  // /resume brings a conversation with its history: no card on top of it.
  eng.world.turns = 6
  await $.session.end({ reason: 'resume', sessionId: eng.world.sessionId } as never)
  eng.world.sessionId = 'an-older-conversation'
  await eng.advance(200)
  await eng.settle()
  expect(eng.placed.filter(id => id.startsWith('welcome-')), 'no card over a resumed history').toHaveLength(2)
})

test('the banner opens a cleared conversation in a terminal whatever the turn count says', { options: { language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on, { store: { welcomed: 1 }, surfaces: ['terminal'], isLookDrawn: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(1)
  eng.world.turns = 1
  await clearTo($, eng, 'next-session')
  expect(eng.placed.filter(id => id.startsWith('hello-'))).toHaveLength(2)
})

test('a watch that a later one replaced sets nothing up', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // Two ends in a row, as /clear right after /clear: one watch is left, and one set-up.
  await $.session.end({ reason: 'clear', sessionId: eng.world.sessionId } as never)
  await $.session.end({ reason: 'clear', sessionId: eng.world.sessionId } as never)
  eng.world.sessionId = 'next-session'
  await eng.advance(200)
  await eng.advance(200)
  await eng.settle()
  expect(eng.placed.filter(id => id.startsWith('welcome-')), 'one card for the new conversation').toHaveLength(2)
})

test('the game sets a new conversation up once: one card, whatever fires', { options: { mode: 'full', language: 'en' } }, async ($, on) => {
  const eng = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(eng.placed.filter(id => id.startsWith('welcome-'))).toHaveLength(1)
  await clearTo($, eng, 'second-conversation')
  expect(eng.placed.filter(id => id.startsWith('welcome-'))).toHaveLength(2)
  // The first prompt of the conversation comes after the watch: nothing more to do.
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await eng.advance(6000)
  await eng.settle()
  expect(eng.placed.filter(id => id.startsWith('welcome-')), 'one card for the conversation').toHaveLength(2)
})

test('a turn that dies at a full window is one bust; an outage is a stalled ride', { options: { mode: 'full', language: 'en', sounds: true } }, async ($, on) => {
  const eng = stubEngine(on, { audioResolvesAtOnce: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  // An outage: the windows are far from full.
  await failTurn($, 't1')
  expect(eng.toasts.filter(t => t.startsWith('Your ride stalled'))).toHaveLength(1)
  expect(eng.placed.some(id => id.startsWith('busted-'))).toBe(false)
  // The window is full: the error is the limit.
  eng.usage.limits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: inHours(1) }]
  await failTurn($, 't2')
  await failTurn($, 't3')
  expect(eng.placed.filter(id => id.startsWith('busted-')), 'one busted card').toHaveLength(1)
  expect(eng.plays.filter(p => p === 1), 'one siren').toHaveLength(1)
  expect(eng.toasts.filter(t => t.startsWith('Your ride stalled')), 'a bust is no stall').toHaveLength(1)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-rap' })
  expect(await pane.find({ text: /Busted\s+1\b/ })).toBeDefined()
  expect(await pane.find({ text: /Rides stalled\s+1\b/ })).toBeDefined()
  await pane.unmount()
})
