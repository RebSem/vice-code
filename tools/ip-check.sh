#!/bin/sh
# Release check: no names of the game, its studio, publisher, places or characters
# in what ships. The stop-list is base64 so this file does not trip the check itself.
# The one allowed line (GAME_LABEL in hooks/lib/time.ts) is marked ip-allow.
# Empty output and exit 0 mean clean. Run from the project folder.
set -u
LIST='Z3RhfGdyYW5kLj90aGVmdHxyb2Nrc3Rhcnx0YWtlLj90d298dmljZS4/Y2l0eXxsZW9uaWRhfGx1Y2lhfGphc29ufGxvcy4/c2FudG9zfHZjcGR8cGF5Lj9uLj9zcHJheXxhbW11Lj9uYXRpb258bGlmZWludmFkZXJ8aWZydWl0fGNsdWNraW58cHJpY2Vkb3dufNCz0YLQsHzQstCw0LnRgS4/0YHQuNGC0Lh80LvQtdC+0L3QuNC0W9Cw0LXRi9GDXXzQu9GO0YHQuFvRj9C4XXzQu9GD0YHQuNGPfNC00LbQtdC50YHQvtC9fNGA0L7QutGB0YLQsNGAfNC70L7RgS4/0YHQsNC90YLQvtGB' # ip-allow
RE=$(printf %s "$LIST" | base64 --decode 2>/dev/null || printf %s "$LIST" | base64 -D)
export LC_ALL=C.UTF-8
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Tracked plus untracked-but-not-ignored files: what `git add -A` would publish.
  hits=$(git grep --untracked -nIiE "$RE" -- . | grep -v 'ip-allow')
  names=$(git ls-files -co --exclude-standard | grep -iE "$RE")
else
  hits=$(grep -rnIiE "$RE" --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=preview --exclude-dir=notes --exclude-dir=launch . | grep -v 'ip-allow')
  names=$(find . -path ./node_modules -prune -o -path ./.git -prune -o -path ./notes -prune -o -path ./launch -prune -o -print | grep -iE "$RE")
fi
if [ -n "$hits$names" ]; then
  printf '%s\n' "$hits" "$names" | grep -v '^$'
  exit 1
fi
