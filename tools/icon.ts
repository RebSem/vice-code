// Draws the plugin icon (.claude-plugin/icon.svg) from the same tile code the mod uses.
// Turn it into the 1024 × 1024 PNG the plugin directory wants with a headless browser:
//
//   npx -y esbuild@0.24.0 tools/icon.ts --bundle --platform=node --format=esm --outfile=preview/out/icon.mjs && node preview/out/icon.mjs
//   chrome --headless --screenshot=.claude-plugin/icon.png --window-size=1024,1024 file://$PWD/.claude-plugin/icon.svg

import { writeFileSync } from 'node:fs'

import { iconSvg } from '../hooks/lib/tiles'

writeFileSync('.claude-plugin/icon.svg', iconSvg())
console.log('.claude-plugin/icon.svg')
