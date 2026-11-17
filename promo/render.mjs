// Renders the film's frames with headless Chrome: loads film.html, hands it the assets,
// then for every frame sets the time and takes a screenshot. Run by promo/build.sh.
//
//   node promo/render.mjs <work folder> h|v              all 600 frames → <work>/frames-h/
//   node promo/render.mjs <work folder> h|v 0,3.5,12.9   stills at those seconds → <work>/stills-h/

import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [work, format = 'h', only] = process.argv.slice(2)
if (!work) throw new Error('usage: node render.mjs <work folder> h|v [seconds,...]')
// puppeteer-core lives in the work folder, never in the repo.
const puppeteer = createRequire(join(work, 'package.json'))('puppeteer-core')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FPS = 30
const FRAMES = 600
const [w, h] = format === 'h' ? [1920, 1080] : [1080, 1920]

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, 'film.html'), 'utf8')
const assets = JSON.parse(readFileSync(join(work, 'assets.json'), 'utf8'))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
  defaultViewport: { width: w, height: h, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
page.on('pageerror', e => console.error('page error:', e.message))
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate((a, f) => init(a, f), assets, format)

const times = only ? only.split(',').map(Number) : Array.from({ length: FRAMES }, (_, i) => i / FPS)
const dir = join(work, (only ? 'stills-' : 'frames-') + format)
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
for (let i = 0; i < times.length; i++) {
  await page.evaluate(t => setTime(t), times[i])
  const name = only ? `s${String(times[i]).replace('.', '_')}.png` : `f${String(i).padStart(4, '0')}.png`
  await page.screenshot({ path: join(dir, name), clip: { x: 0, y: 0, width: w, height: h } })
  if (!only && i % 60 === 0) console.log(`${format} frame ${i}/${times.length}`)
}
await browser.close()
