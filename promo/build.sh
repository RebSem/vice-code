#!/bin/sh
# Builds the Vice Code promo film from the repo: two videos, two posters and the README GIF.
#
#   sh promo/build.sh            run from the project folder
#
# Needs node, Google Chrome (CHROME=/path/to/chrome to override) and ffmpeg. Scratch files
# and puppeteer-core go to $PROMO_WORK (default: $TMPDIR/vice-promo), never into the repo.
# Writes promo/out/vice-code-16x9.mp4, vice-code-9x16.mp4, poster-16x9.png, poster-9x16.png
# (promo/out/ is git-ignored) and docs/img/demo.gif.
#
# The film: promo/film.html lays out every frame as a pure function of time; promo/assets.ts
# takes every picture and the soundtrack from the mod's own code (hooks/lib/tiles.ts, card.ts,
# synth.ts); promo/render.mjs screenshots the 600 frames with headless Chrome.
set -eu
cd "$(dirname "$0")/.."
WORK=${PROMO_WORK:-${TMPDIR:-/tmp}/vice-promo}
FFMPEG=${FFMPEG:-ffmpeg}
command -v "$FFMPEG" >/dev/null 2>&1 || FFMPEG=/opt/homebrew/bin/ffmpeg
mkdir -p "$WORK" promo/out docs/img

if [ ! -d "$WORK/node_modules/puppeteer-core" ]; then
  (cd "$WORK" && { [ -f package.json ] || npm init -y >/dev/null; } && PUPPETEER_SKIP_DOWNLOAD=1 npm i --silent puppeteer-core@23.11.1)
fi

# The pictures and the radio loop, from the mod's own code.
npx -y esbuild@0.24.0 promo/assets.ts --bundle --platform=node --format=esm --outfile="$WORK/assets.mjs" --log-level=warning
node "$WORK/assets.mjs" "$WORK"

# The soundtrack: the loop to 20 s, in over 0.3 s, out over the last 1.5 s.
"$FFMPEG" -loglevel error -y -stream_loop -1 -i "$WORK/radio.wav" -t 20 \
  -af "afade=t=in:st=0:d=0.3,afade=t=out:st=18.5:d=1.5" "$WORK/soundtrack.wav"

for f in h v; do
  node promo/render.mjs "$WORK" "$f"
  name=$([ "$f" = h ] && echo 16x9 || echo 9x16)
  "$FFMPEG" -loglevel error -y -framerate 30 -i "$WORK/frames-$f/f%04d.png" -i "$WORK/soundtrack.wav" \
    -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -c:a aac -b:a 192k -shortest -movflags +faststart \
    "promo/out/vice-code-$name.mp4"
  # The poster: the end card, held still.
  cp "$WORK/frames-$f/f0599.png" "promo/out/poster-$name.png"
done

# The README GIF: the look arriving, then the game (6.2 s to 14.2 s), 800 px wide, 12 fps.
"$FFMPEG" -loglevel error -y -start_number 186 -framerate 30 -t 8 -i "$WORK/frames-h/f%04d.png" \
  -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  docs/img/demo.gif
ls -l promo/out docs/img/demo.gif
