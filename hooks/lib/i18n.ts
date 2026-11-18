// Interface labels in Russian and English. Flavour text (tips, spinner, toasts)
// lives in content.ts; this file holds the words the screens are built from.

import type { Lang, Tab } from '../../types'
import { fmtInt, pluralRu } from './format'
import { GAME_LABEL } from './time'

export type Labels = {
  forClaudeCode: string
  missionsWeek: string
  tokensWeek: string
  linesWeek: string
  streak: string
  countdown: (days: string) => string
  releaseDay: string
  released: string
  tip: string
  importing: (done: number, total: number) => string
  imported: (sessions: number, since: string) => string
  health: string
  armor: string
  healthHint: string
  armorHint: string
  noLimit: string
  radioOff: string
  radioHint: string
  statsTitle: string
  tabs: Record<Tab, string>
  rows: {
    missions: string
    timeInMiami: string
    longestChase: string
    laundered: string
    cacheRead: string
    spent: string
    spentPartial: string
    stolen: string
    wrecked: string
    nightRuns: string
    streak: string
    since: string
    favouriteRide: string
    thisSession: string
    prompts: string
    tools: string
    busts: string
    escapes: string
    maxStars: string
    medkits: string
    medkitTokens: string
    stalls: string
    wantedNow: string
    armorNow: string
  }
  arsenalEmpty: string
  ridesEmpty: string
  mapEmpty: string
  missionsShort: (n: number) => string
  responsesShort: (n: string) => string
  partialCost: string
  scratch: string
  buttons: { stats: string; radioOn: string; radioOff: string; ownRadio: string; nextTip: string; gameOn: string }
  /**
   * Lite's hello card. `body` is for a window that draws the look; `bodyPlain` for a
   * terminal or an editor, which draw neither the colors nor the scene.
   */
  lite: { title: string; body: string; bodyScene: string; bodyPlain: string; hint: string; hintShort: string; fan: string }
  /** Under the welcome card on the terminal, where a row in the conversation has no hotkeys. */
  welcomeHint: string
  /** Said once after install: what the three meters stand for. */
  legend: string
  needsUpdate: string
  sceneAlt: string
  command: {
    description: string
    hint: string
    statsOpened: string
    statsNotPlaced: (reason: string) => string
    cardShown: string
    backdropOn: string
    backdropOff: string
    backdropNone: (reason: string) => string
    alreadyOn: string
    turnedOn: string
    isOff: string
    turnedOff: string
    alreadyFull: string
    modeFull: string
    alreadyLite: string
    modeLite: string
    paperHelp: string
    paperSet: Record<'auto' | 'light' | 'dark', string>
    /** In Lite, to a command that belongs to the game. */
    gameOnly: string
    helpLite: string
    radioOn: string
    radioOff: string
    radioNoPlayer: string
    importStarted: string
    importStartedFull: string
    importOff: string
    importFailed: (reason: string) => string
    help: string
  }
  dayNames: string
  wanted: {
    label: string
    clean: string
    noLimits: string
    /** Names of star levels 1..5. */
    levels: [string, string, string, string, string]
    resetIn: (left: string) => string
    starToast: (stars: string, name: string, pct: string, when: string | null) => string
    escape: string
    /** The banner's one loud word, and the same word at rest for a line of text. */
    busted: string
    bustedShort: string
    releasedShort: string
    bustedWhy: Record<'short' | 'week' | 'spend' | 'hidden', string>
    outAt: (at: string) => string
    bustedUntil: (at: string, left: string) => string
    bustedUnknown: string
    bustedPass: string
    released: string
    overage: string
    armor: (level: 75 | 90, left: string, when: string | null, kind: 'week' | 'spend') => string
    swapRide: string
    healthLow: (pct: string) => string
    medkitManual: (before: string, after: string) => string
    medkitAuto: (before: string, after: string) => string
    stall: string
  }
}

export const LABELS: Record<Lang, Labels> = {
  ru: {
    forClaudeCode: 'для Claude Code',
    missionsWeek: 'миссий за неделю',
    tokensWeek: 'токенов отмыто',
    linesWeek: 'строк угнано',
    streak: 'серия',
    countdown: days => `${GAME_LABEL} через ${days}`,
    releaseDay: `${GAME_LABEL} выходит сегодня`,
    released: `${GAME_LABEL} уже вышла. Увидимся на пляже`,
    tip: 'Совет',
    importing: (done, total) => `Поднимаю архив: ${done} из ${total}. Читаю на этой машине, ничего не отправляю`,
    imported: (n, since) => `Архив поднят: ${fmtInt(n, 'ru')} ${pluralRu(n, ['миссия', 'миссии', 'миссий'])} с ${since}`,
    health: 'Здоровье',
    armor: 'Броня',
    healthHint: 'контекст до автосжатия',
    armorHint: 'остаток недельного лимита',
    noLimit: 'без лимита',
    radioOff: 'радио выкл.',
    radioHint: '/vice radio',
    statsTitle: 'Статистика',
    tabs: { general: 'Общее', rap: 'Досье', arsenal: 'Арсенал', rides: 'Тачки', map: 'Районы' },
    rows: {
      missions: 'Миссий пройдено',
      timeInMiami: 'Время в Майами',
      longestChase: 'Самое долгое дело',
      laundered: 'Отмыто токенов',
      cacheRead: 'Из тайника (кэш)',
      spent: 'Уличная цена (по ценам API)',
      spentPartial: 'Уличная цена* (по ценам API)',
      stolen: 'Угнано строк',
      wrecked: 'Снесено строк',
      nightRuns: 'Ночных вылазок',
      streak: 'Серия',
      since: 'В деле с',
      favouriteRide: 'Любимая тачка',
      thisSession: 'Эта сессия',
      prompts: 'Реплик',
      tools: 'Выстрелов',
      busts: 'Арестов',
      escapes: 'Побегов',
      maxStars: 'Рекорд розыска',
      medkits: 'Аптечек',
      medkitTokens: 'Вылечено токенов',
      stalls: 'Заглохло тачек',
      wantedNow: 'Розыск (лимит 5 ч)',
      armorNow: 'Броня (недельный лимит)',
    },
    arsenalEmpty: 'Арсенал пуст. Пора на дело.',
    ridesEmpty: 'Гараж пока пуст.',
    mapEmpty: 'Районы появятся после первых миссий.',
    missionsShort: n => `${fmtInt(n, 'ru')} ${pluralRu(n, ['миссия', 'миссии', 'миссий'])}`,
    responsesShort: n => `${n} отв.`,
    partialCost: '* в части старых сессий нет записи о стоимости и строках',
    scratch: 'черновики',
    buttons: {
      stats: 'Статистика',
      radioOn: 'Включить радио',
      radioOff: 'Выключить радио',
      ownRadio: 'Своё радио',
      nextTip: 'Ещё совет',
      gameOn: 'Включить игру',
    },
    lite: {
      title: 'Добро пожаловать в Майами.',
      body: 'Claude Code теперь в цветах заката, а за разговором стоит город из символов. Он живёт по часам: рассвет, день, закат, ночь. Проведи курсором по небу на картинке выше.',
      bodyScene: 'За разговором теперь стоит город из символов. Он живёт по часам: рассвет, день, закат, ночь. Проведи курсором по небу на картинке выше.',
      bodyPlain: 'Цвета и город за разговором рисуют десктопное и мобильное приложения. Здесь можно включить игру: /vice full',
      hint: '/vice full — игра: розыск, шкалы, статистика · /vice paper dark — под тёмное окно · /vice off — выключить',
      hintShort: '/vice full — игра · /vice off — выключить',
      fan: 'неофициальный фан-мод',
    },
    welcomeHint: '/vice — статистика · /vice radio — радио · /vice tip — ещё совет',
    legend: 'Vice Code: звёзды — пятичасовой лимит, броня — недельный лимит, здоровье — контекст до автосжатия. Подробности: /vice',
    needsUpdate: 'Vice Code нужен Claude Code 2.1.319 или новее. Обнови: claude update',
    sceneAlt: 'Майами',
    command: {
      description: 'Vice Code: оформление в духе Майами и игра поверх него: розыск, статистика, радио',
      hint: '[full|lite|stats|wanted|card|radio|tip|backdrop|paper|import|off|help]',
      statsOpened: 'Статистика Vice Code открыта в панели.',
      statsNotPlaced: reason => `Панель пока не показана (${reason}). Расширь окно или открой её ещё раз.`,
      cardShown: 'Карточка — в конце разговора.',
      backdropOn: 'Город за разговором включён.',
      backdropOff: 'Город за разговором выключен.',
      backdropNone: reason => `Фон здесь не рисуется (${reason}). Он есть в десктопном и мобильном приложении.`,
      alreadyOn: 'Vice Code уже включён.',
      turnedOn: 'Vice Code снова включён.',
      isOff: 'Vice Code выключен. Включить: /vice on',
      turnedOff: 'Vice Code выключен: ни оформления, ни игры, в этой сессии и в следующих. Включить: /vice on',
      alreadyFull: 'Игра уже включена. Статистика: /vice stats · тихая версия: /vice lite',
      modeFull: 'Игра включена: розыск, шкалы над полем ввода, оружие у инструментов, статистика. Тихая версия: /vice lite',
      alreadyLite: 'Lite уже включён: цвета и город за разговором. Игра: /vice full',
      modeLite: 'Lite: только цвета и город за разговором. Игра: /vice full',
      paperHelp: '/vice paper dark — сцена на тёмной бумаге · /vice paper light — на светлой · /vice paper auto — как окно',
      paperSet: {
        dark: 'Сцена теперь на тёмной бумаге. Окно остаётся в своём режиме; /vice paper auto вернёт подстройку под окно.',
        light: 'Сцена теперь на светлой бумаге. Окно остаётся в своём режиме; /vice paper auto вернёт подстройку под окно.',
        auto: 'Сцена снова подстраивается под окно.',
      },
      gameOnly: 'Это часть игры. Включить: /vice full',
      helpLite:
        '/vice full — включить игру: розыск, шкалы, статистика\n/vice paper dark|light|auto — подогнать сцену под окно\n/vice backdrop — включить или выключить город за разговором\n/vice radio — включить или выключить радио\n/vice card — показать карточку ещё раз\n/vice off — выключить Vice Code',
      radioOn: 'Радио в эфире. Выключить: /vice radio',
      radioOff: 'Радио выключено.',
      radioNoPlayer: 'Здесь нет проигрывателя. В терминале радио играет только на macOS.',
      importStarted: 'Дочитываю новые сессии.',
      importStartedFull: 'Пересчитываю всю историю заново.',
      importOff: 'Импорт истории выключен в /config (vice-code → Import history).',
      importFailed: reason => `Архив не поднялся: ${reason}`,
      help:
        '/vice — статистика в панели\n/vice wanted — досье: розыск, броня, аресты, аптечки\n/vice card — показать карточку\n/vice backdrop — включить или выключить город за разговором (десктоп)\n/vice paper dark|light|auto — подогнать сцену под окно\n/vice radio — включить или выключить радио\n/vice tip — следующий совет\n/vice import — дочитать новые сессии\n/vice import full — пересчитать всю историю\n/vice lite — тихая версия: только цвета и город\n/vice off — выключить Vice Code',
    },
    dayNames: 'дн.',
    wanted: {
      label: 'Розыск',
      clean: 'чисто',
      noLimits: 'без лимитов',
      levels: ['Тебя заметили', 'Патруль на хвосте', 'Вертолёт в небе', 'Спецназ у дверей', 'Весь Майами на ушах'],
      resetIn: left => `сброс через ${left}`,
      starToast: (stars, name, pct, when) => `${stars} ${name}: занято ${pct} пятичасового лимита.${when ? ` Копы отстанут ${when}.` : ''}`,
      escape: 'Погоня позади. Пятичасовой лимит обнулился, розыск снят.',
      busted: 'ПОВЯЗАЛИ',
      bustedShort: 'Повязали',
      releasedShort: 'На свободе. Лимит обновился.',
      bustedWhy: {
        short: 'Пятичасовой лимит кончился.',
        week: 'Недельный лимит кончился.',
        spend: 'Бюджет кончился.',
        hidden: 'Claude упёрся в лимит, которого не видно в цифрах.',
      },
      outAt: at => `выход ${at}`,
      bustedUntil: (at, left) => `Выпустят ${at} (через ${left}).`,
      bustedUnknown: 'Когда выпустят, Claude скажет сам.',
      bustedPass: 'Пока ждёшь: /vice — статистика, /vice radio — музыка.',
      released: 'На свободе. Лимит обновился, можно снова на дело.',
      overage: 'Лимит кончился, но Claude отвечает: работаешь в кредит (extra usage). Розыск на максимуме.',
      armor: (level, left, when, kind) => {
        const what = kind === 'week' ? 'недельного лимита' : 'бюджета'
        const head = level === 90 ? 'Броня на последнем издыхании' : 'Броня трещит'
        return `${head}: осталось ${left} ${what}.${when ? ` Обнулится ${when}.` : ''}`
      },
      swapRide: 'Суперкар жрёт лимит. Пересядь на маслкар: /model sonnet',
      healthLow: pct => `Здоровье на исходе: ${pct}. Аптечка: /compact`,
      medkitManual: (before, after) => `Аптечка: ${before} → ${after} токенов.`,
      medkitAuto: (before, after) => `Тебя откачали парамедики: ${before} → ${after} токенов.`,
      stall: 'Тачка заглохла: сервер перегружен или сбоит. Попробуй чуть позже.',
    },
  },
  en: {
    forClaudeCode: 'for Claude Code',
    missionsWeek: 'missions this week',
    tokensWeek: 'tokens laundered',
    linesWeek: 'lines stolen',
    streak: 'streak',
    countdown: days => `${GAME_LABEL} in ${days}`,
    releaseDay: `${GAME_LABEL} drops today`,
    released: `${GAME_LABEL} is out. See you on the beach`,
    tip: 'Tip',
    importing: (done, total) => `Digging up the archive: ${done} of ${total}. Read on this machine, nothing is sent`,
    imported: (n, since) => `Archive restored: ${fmtInt(n, 'en')} ${n === 1 ? 'mission' : 'missions'} since ${since}`,
    health: 'Health',
    armor: 'Armor',
    healthHint: 'context left before auto-compact',
    armorHint: 'weekly limit left',
    noLimit: 'no limit',
    radioOff: 'radio off',
    radioHint: '/vice radio',
    statsTitle: 'Stats',
    tabs: { general: 'General', rap: 'Rap sheet', arsenal: 'Arsenal', rides: 'Rides', map: 'Turf' },
    rows: {
      missions: 'Missions passed',
      timeInMiami: 'Time in Miami',
      longestChase: 'Longest job',
      laundered: 'Tokens laundered',
      cacheRead: 'From the stash (cache)',
      spent: 'Street value (API prices)',
      spentPartial: 'Street value* (API prices)',
      stolen: 'Lines stolen',
      wrecked: 'Lines wrecked',
      nightRuns: 'Night runs',
      streak: 'Streak',
      since: 'In the game since',
      favouriteRide: 'Favourite ride',
      thisSession: 'This session',
      prompts: 'Prompts',
      tools: 'Shots fired',
      busts: 'Busted',
      escapes: 'Got away',
      maxStars: 'Most wanted',
      medkits: 'Medkits used',
      medkitTokens: 'Tokens healed',
      stalls: 'Rides stalled',
      wantedNow: 'Wanted (5-hour limit)',
      armorNow: 'Armor (weekly limit)',
    },
    arsenalEmpty: 'The arsenal is empty. Time for a job.',
    ridesEmpty: 'The garage is empty for now.',
    mapEmpty: 'Your turf shows up after the first missions.',
    missionsShort: n => `${fmtInt(n, 'en')} ${n === 1 ? 'mission' : 'missions'}`,
    responsesShort: n => `${n} resp.`,
    partialCost: '* some older sessions have no cost or line record',
    scratch: 'scratch pads',
    buttons: {
      stats: 'Stats',
      radioOn: 'Play radio',
      radioOff: 'Stop radio',
      ownRadio: 'Your radio',
      nextTip: 'Next tip',
      gameOn: 'Turn on the game',
    },
    lite: {
      title: 'Welcome to Miami.',
      body: 'Claude Code now wears the sunset: its colors, and a skyline set in symbols behind the conversation. It follows the hour: dawn, day, sunset, night. Run the pointer across the sky in the picture above.',
      bodyScene: 'A skyline set in symbols now stands behind the conversation. It follows the hour: dawn, day, sunset, night. Run the pointer across the sky in the picture above.',
      bodyPlain: 'The colors and the skyline are drawn by the desktop and mobile apps. Here you can turn on the game: /vice full',
      hint: '/vice full — the game: wanted level, HUD, stats · /vice paper dark — match a dark window · /vice off',
      hintShort: '/vice full — the game · /vice off — turn it off',
      fan: 'unofficial fan mod',
    },
    welcomeHint: '/vice for stats · /vice radio · /vice tip',
    legend: 'Vice Code: stars are the 5-hour limit, armor is the weekly limit, health is context left before auto-compact. More: /vice',
    needsUpdate: 'Vice Code needs Claude Code 2.1.319 or newer. Update with: claude update',
    sceneAlt: 'Miami',
    command: {
      description: 'Vice Code: a Miami look, and a game on top of it: wanted level, stats, radio',
      hint: '[full|lite|stats|wanted|card|radio|tip|backdrop|paper|import|off|help]',
      statsOpened: 'Vice Code stats are open in the pane.',
      statsNotPlaced: reason => `The pane is not shown yet (${reason}). Widen the window or open it again.`,
      cardShown: 'The welcome card is at the end of the conversation.',
      backdropOn: 'The skyline behind the conversation is on.',
      backdropOff: 'The skyline behind the conversation is off.',
      backdropNone: reason => `No backdrop here (${reason}). It shows in the desktop and mobile apps.`,
      alreadyOn: 'Vice Code is already on.',
      turnedOn: 'Vice Code is back on.',
      isOff: 'Vice Code is off. Turn it on: /vice on',
      turnedOff: 'Vice Code is off: no look and no game, in this session and the next ones. Turn it on: /vice on',
      alreadyFull: 'The game is already on. Stats: /vice stats · the quiet version: /vice lite',
      modeFull: 'Game on: wanted level, a HUD above the prompt, gear on tool rows, stats. The quiet version: /vice lite',
      alreadyLite: 'Lite is already on: the colors and the skyline. The game: /vice full',
      modeLite: 'Lite: the colors and the skyline only. The game: /vice full',
      paperHelp: '/vice paper dark — the scene on dark stock · /vice paper light — on light paper · /vice paper auto — follow the window',
      paperSet: {
        dark: 'The scene now prints on dark stock. The window keeps its own mode; /vice paper auto goes back to following it.',
        light: 'The scene now prints on light paper. The window keeps its own mode; /vice paper auto goes back to following it.',
        auto: 'The scene follows the window again.',
      },
      gameOnly: 'That is part of the game. Turn it on: /vice full',
      helpLite:
        '/vice full — turn on the game: wanted level, HUD, stats\n/vice paper dark|light|auto — match the scene to the window\n/vice backdrop — skyline on or off\n/vice radio — radio on or off\n/vice card — show the card again\n/vice off — turn Vice Code off',
      radioOn: 'Radio is on air. Turn it off: /vice radio',
      radioOff: 'Radio is off.',
      radioNoPlayer: 'No audio player here. In a terminal the radio plays on macOS only.',
      importStarted: 'Reading new sessions.',
      importStartedFull: 'Re-reading the whole session archive.',
      importOff: 'History import is off in /config (vice-code → Import history).',
      importFailed: reason => `The archive did not load: ${reason}`,
      help:
        '/vice — stats in the pane\n/vice wanted — rap sheet: wanted level, armor, busts, medkits\n/vice card — show the welcome card\n/vice backdrop — skyline on or off (desktop app)\n/vice paper dark|light|auto — match the scene to the window\n/vice radio — radio on or off\n/vice tip — next tip\n/vice import — read new sessions\n/vice import full — recount all history\n/vice lite — the quiet version: colors and skyline only\n/vice off — turn Vice Code off',
    },
    dayNames: 'd',
    wanted: {
      label: 'Wanted',
      clean: 'clean',
      noLimits: 'no limits',
      levels: ['You were spotted', 'A patrol is on you', 'Chopper overhead', 'SWAT at the door', 'All of Miami is out'],
      resetIn: left => `resets in ${left}`,
      starToast: (stars, name, pct, when) => `${stars} ${name}: ${pct} of the 5-hour limit used.${when ? ` The cops back off ${when}.` : ''}`,
      escape: 'You got away. The 5-hour limit reset and the heat is off.',
      busted: 'BUSTED',
      bustedShort: 'Busted',
      releasedShort: 'You are out. The limit reset.',
      bustedWhy: {
        short: 'The 5-hour limit is used up.',
        week: 'The weekly limit is used up.',
        spend: 'The spend limit is used up.',
        hidden: 'Claude hit a limit the numbers do not show.',
      },
      outAt: at => `out ${at}`,
      bustedUntil: (at, left) => `Out ${at} (in ${left}).`,
      bustedUnknown: 'Claude will tell you when you are out.',
      bustedPass: 'While you wait: /vice for your stats, /vice radio for music.',
      released: 'You are out. The limit reset, back to work.',
      overage: 'The limit is used up but Claude still answers: you are on credit (extra usage). Wanted level maxed.',
      armor: (level, left, when, kind) => {
        const what = kind === 'week' ? 'of the weekly limit' : 'of the budget'
        const head = level === 90 ? 'Armor almost gone' : 'Armor is cracking'
        return `${head}: ${left} ${what} left.${when ? ` Resets ${when}.` : ''}`
      },
      swapRide: 'The supercar burns through the limit. Switch to the muscle car: /model sonnet',
      healthLow: pct => `Health running low: ${pct}. Medkit: /compact`,
      medkitManual: (before, after) => `Medkit: ${before} → ${after} tokens.`,
      medkitAuto: (before, after) => `The paramedics pulled you through: ${before} → ${after} tokens.`,
      stall: 'Your ride stalled: the API is overloaded or erroring. Try again shortly.',
    },
  },
}

/** "2026-03-03" → "3 марта 2026" / "Mar 3, 2026". */
export function fmtDate(key: string, lang: Lang): string {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  const ru = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return lang === 'ru' ? `${d} ${ru[m - 1]} ${y}` : `${en[m - 1]} ${d}, ${y}`
}
