// Every picture in the film, taken from the mod's own code: the scenes, the busted banner,
// the stars, the meters, the terminal pixels and the radio loop. Bundled and run by
// promo/build.sh, which passes the work folder; writes assets.json and radio.wav there.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { meterSvg, starsSvg } from '../hooks/lib/card'
import { sound } from '../hooks/lib/synth'
import { backdropSvg, bustedSvg, scenePixels } from '../hooks/lib/tiles'

const out = process.argv[2]
if (!out) throw new Error('usage: node assets.mjs <work folder>')

const assets = {
  scenes: {
    sunset0: backdropSvg('sunset', 'dark', 0, false),
    sunset3: backdropSvg('sunset', 'dark', 3, true),
    sunset4: backdropSvg('sunset', 'dark', 4, true),
    light: backdropSvg('sunset', 'light', 0, false),
    night: backdropSvg('night', 'dark', 0, false),
  },
  busted: bustedSvg('BUSTED', 'github.com/RebSem/vice-code', true),
  stars: [0, 1, 2, 3, 4].map(n => starsSvg(n, n >= 3 ? 'flash' : 'still')),
  meters: Object.fromEntries([100, 85, 70, 55, 40, 25, 12, 0].map(p => [p, meterSvg(p)])),
  pixels: scenePixels('sunset', 36, 8),
}

writeFileSync(join(out, 'assets.json'), JSON.stringify(assets))
writeFileSync(join(out, 'radio.wav'), Buffer.from(sound('radio'), 'base64'))
