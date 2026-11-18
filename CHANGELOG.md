# Changelog

## 1.3.0 — 2026-11-18

A switch you can see.

### Added

- **Off · Look · Game, above the prompt.** In the desktop and mobile apps a row of three buttons stands above the prompt, the position in force drawn as the main one. Off clears the look and silences the mod, Look is Lite, Game is Full. The row stays when the mod is off, so the same switch turns it back on. `/vice switch` or the `switch` setting hides it. `/vice off`, `/vice lite` and `/vice full` do the same three things anywhere, and the last two now also turn a mod that is off back on, straight into that mode. A terminal keeps its band for the game and uses the commands. Changes of mode run one after another, so two quick presses end in the state pressed last.

### Fixed

- **A new conversation is set up even when the mod is not told about it.** In the desktop app a plugin of the app's own passes a mod's `classic.SessionStart` hook by, so after `/clear` the mod never set itself up again. It now checks for itself a moment after a conversation ends, and again at the first prompt; where the start hook does arrive, late or not, the conversation is still set up once.
- A mod that starts in the off state speaks the right language: the switch and the command no longer fall back to English.

### Changed

- The README and the hello card say where to look: a mod runs inside a session, so the app's own start screen shows nothing of it until the first message is sent.

Tests: 70, passing on Claude Code 2.1.319 and 2.1.325. The plugin now has 18 settings.

## 1.2.1 — 2026-11-18

What two checks against the app's own engine turned up, a few hours after 1.2.0.

### Fixed

- **`/vice paper dark` and `light` no longer drop half of the colors.** The desktop app keeps the window's own mode whatever a look asks for, so a look made for one mode left a window in the other mode without the mod's colors. The colors now always go in both modes and the look no longer asks the window to switch: the paper changes the scene alone, and the command's reply says that the window keeps its own mode.
- **An app window that joined without announcing itself counts as an app window.** A window can get onto a session's roster just by asking to draw, without saying that it draws themes. The engine then answers "not drawn" although it hands that window the theme. The mod took this for a terminal: it showed the hello card in every new conversation and sent the look again at the first turn. It now reads the roster as well. A terminal with a phone attached is still a terminal and keeps its card at the top of each conversation.
- **A second chance to wake.** A mod that went dormant in a session a program started wakes when a window attaches. If that event ever fails to reach the module, one of the person's first prompts now finds the window on the roster and wakes the mod. A run nobody watches is asked five times and then left alone.
- **Two looks sent at once no longer trip each other.** A window attaching while the mod was waking could make it forget that the scene was drawn, and the once-after-install card came again in the next conversation.
- The hello card speaks of the colors only where the engine took them. An engine from before the colors gets a card about the skyline alone.
- The `playerName` setting no longer mentions a "loading card": it is the welcome card.

### Changed

- The hello card says "the picture above" for the banner whose sky answers the pointer. The skyline behind the conversation does not take the pointer in the desktop app, which keeps a backdrop in an inert layer under the conversation; the docs and the code comments now say so plainly.

### Checked

- The engine was run the way the desktop app runs it: headless over stream-json, under an empty config folder, with a desktop client attached by the engine's own `ui_attach` request, and again with a client that joined only by asking to draw. On 2.1.325 (the app's engine): with no client the mod stayed dormant; on either kind of join it woke once and registered `/vice`, the look went out with the colors in both modes and the scene, one hello card was placed and drawn, the backdrop came back as an SVG of 98,948 characters, and `/vice`, `/vice paper dark`, `/vice full` and `/vice off` answered. On 2.1.319 the same runs passed with the scene alone, since that engine has no colors. The 2.1.325 runs were repeated on the released code.
- Tests: 64, passing on Claude Code 2.1.319 and 2.1.325.

## 1.2.0 — 2026-11-18

Two modes: the look on its own by default, the game one command away.

### Added

- **Lite, the new default.** The mod starts as the look alone: the app's colors and the skyline behind the conversation. Lite reads nothing from the history and counts nothing. There is no history import, no HUD, no wanted level, no gear labels, no spinner lines and no toasts.
- **Full, the game.** Everything 1.1.0 had (the wanted level, armor, health, busts, escapes, medkits, the HUD, gear labels, the Miami spinner, the stats pane, street talk, the radio) is now the Full mode, on top of the same look. `/vice full` or the hello card's button turns it on, `/vice lite` turns it off. What the game counted stays in the store while it is off.
- **The app's colors.** In the desktop and mobile apps the mod sends a full set of colors with the scene (`$.theme.set({ colors })`, built with `makeColors`): a violet stock, a pink accent and an orange warning, in a light and a dark version. The `colors` setting turns them off. An engine from before the colors (the 2.1.319 terminal) gets the scene and the cards without them.
- **A hello card.** Where the look is drawn, one card comes after install to say what changed, with a "Turn on the game" button. Its banner's sky lights up under the pointer (CSS `:hover`, no script). In a terminal or an editor, which draw neither the colors nor the skyline, Lite is a small banner card at the top of each new conversation.
- **`/vice off` and `/vice on`.** `/vice off` clears the look and every hook steps aside, in this session and the next ones, until `/vice on`.
- **`/vice paper dark|light|auto`** picks the stock the scene prints on. `dark` and `light` also send the colors for that one mode.
- **`mode` and `colors` settings.** `mode` is `lite` or `full`, `lite` by default. `colors` is on by default. The plugin now has 17 settings.

### Changed

- **The scene is redrawn.** The sky is a field of glyphs that brightens toward the horizon; the city, the palms and the slatted sun stay square tiles, so the skyline reads more clearly. The sun stands at the right edge with a slim palm and a tall one in front of it, towers stand to both sides, and a boat crosses the water. At four stars a car runs the length of the shore under the helicopter.
- **The backdrop is quieter than the banners.** It stands behind the words of a conversation, wherever the column happens to be, so it prints with a lower glow and the sun at part strength, and on light paper with a pale silhouette. The banners in the cards keep their full color. The horizon sits lower, and the picture is held by its foot when the window crops it.
- **Motion is stepped.** Every animation uses `steps()`: the sun's blind, the palms, the tide, the boat, the birds, the clouds and a slow wave of light through the sky move a tile at a time, so the scene repaints a few times a second at most. Reduced motion still rests it.
- **Narrow windows and phones.** The two sides of the scene step toward the middle as the window gets narrower (`@media (max-aspect-ratio…)` inside the SVG).
- **Choices hold.** A mode, paper or backdrop picked with `/vice` is stored and holds until the setting of the same name is changed after it.
- **The language is remembered.** Lite reads no history, so the language of your prompts is kept between sessions and the next card greets you in it.

### Fixed

- **The mod now starts in the desktop and mobile apps.** An app drives the engine the way a program does, so its session begins with nobody at it and the app's window attaches a moment later. The mod took such a session for a run nobody watches and stayed out of it. It now wakes when the first window attaches (`session.attach`), or at once if the window is already there. A `claude -p` run or an SDK script never gets a window, so the mod still leaves those alone.
- A window that attaches after the session began now gets the look, and Lite's first card, at that moment instead of never.

Tests: 59, passing on Claude Code 2.1.319 (terminal CLI) and 2.1.325 (the desktop app's engine). `claude plugin validate --strict .` passes on both, and `--profile directory --strict` on 2.1.325.

## 1.1.0 — 2026-11-13

The native look: Vice Code now draws the way Claude Code itself does.

### Changed

- **Words and numbers are the app's own text.** Everything you read is drawn by the surface in its fonts, its type sizes and your theme's colors, so the mod follows a light or a dark theme, in the terminal and in the desktop app. Pictures hold no words any more, except the one on the busted banner.
- **Cards live in the conversation.** The welcome card and the busted card are rows in the transcript (`$.ui.place`), where the engine's own notices stand. They scroll away with the conversation and show on every surface, VS Code and the mobile app included. The card no longer sits above the prompt, so there is nothing to fold.
- **One quiet line above the prompt.** The band is now a single line: wanted level and reset time first, then health, armor and cash. In a narrow terminal the line is cut from the right, so the reset time stays.
- **The lights flash briefly.** A new wanted level of three stars or more, or a bust, flashes for about 13 seconds and then holds still.
- **Fewer toasts.** One star is shown in the HUD only; toasts start at two stars. Street talk comes every 12 turns by default and never more often than every 20 minutes.
- **Plain labels.** "Health", "Armor", "Wanted" in sentence case. Money is labelled "Street value (API prices)". Star toasts say "used". Russian strings no longer assume a gender.
- **A new scene, drawn on a tile grid.** Miami is no longer a gradient sunset. Every mark is a square tile with a glyph in it, in two inks on a stock: clay for the sun, a teal for the palms, the city and the water. No glows, no gradients on objects, and the sun stands to the right, not in the middle. The backdrop, the card banner, the busted banner, the icon and the terminal's pixels all come from the same code (`hooks/lib/tiles.ts`). The technique follows Anthropic's `theme-examples`.
- **Light and dark paper.** Each time of day prints on light paper for a light window and on dark stock for a dark one. The picture follows the window by itself; `paper` in the settings picks one by hand.
- **Motion.** The sun's blind rolls, palms sway, clouds drift, the water ripples, birds cross, windows and stars twinkle. It is slow and stepped, transform and opacity only, and it rests in a composed picture when your system asks for reduced motion.
- **The busted word is set in tiles**, without a glow.
- **The desktop app's prompts count.** Prompts that arrive through the SDK are counted as yours, so the auto language works there.

### Added

- **Live backdrop** behind the conversation in the desktop and mobile apps (`$.theme.set`). It shows your wanted level: patrol lights at the shore from three stars, a helicopter with a searchlight from four, two at five and while busted. Where the backdrop is drawn, the welcome card leaves its own banner out. `/vice backdrop` or the `backdrop` setting turns it off.
- **`hud` setting:** full, compact (wanted level only) or off. A bust still shows with the HUD off.
- **A one-time legend** after install: what the stars, armor and health stand for.
- **A version check:** on Claude Code older than 2.1.319 the mod shows one line asking to update and does nothing else.
- **Mock-ups without installing:** `tools/preview.ts` builds a page with a desktop window, a terminal and the install steps, from your history or from made-up numbers (`--demo`).

### Fixed

- Runs nobody watches (`claude -p`, SDK scripts) no longer start a history import or count as missions: the mod stays out of them.
- A full plugin store (4 MiB) can no longer stop a session from starting: writes of the player name and the records are safe.
- The band yields to the engine's survey, as before, and now also carries no hard-coded colors that vanish on a light terminal.

## 1.0.2 — 2026-10-27

The wanted system: your usage limits as a Miami police chase.

### Added

- **Wanted level.** The 5-hour limit shows as stars in the HUD: ★ at 40%, ★★ at 60%, ★★★ at 75% (the stars flash red and blue), ★★★★ at 88%, ★★★★★ at 97%. Each level is announced once per window with the time the cops back off. From three stars on an Opus model, a one-time tip to switch to Sonnet.
- **Escapes.** A window that resets after three stars or more, without a bust in it, counts as an escape, once per window even with several sessions open. The engine sends no event at a reset, so the mod sets its own alarm for the reset time.
- **Armor.** The weekly limit (or a gateway's spend limit) is the armor bar. Warnings at 75% and 90% used say what is left and when it resets.
- **Busted.** When a limit runs out, the HUD turns into a busted card: which limit, when you are out, and how long that is. A rejected request (`classic.StopFailure` with `rate_limit`) busts you too. The mod blames the fullest window at 97% or more, or says it is a limit the numbers do not show. Such a bust holds until the reset or until Claude answers a new turn.
- **On credit.** With extra usage, a window past 100% that keeps answering is shown as "on credit" instead of busted, and that bust is taken back from the rap sheet.
- **Medkits.** A compaction (`/compact`, auto, or one started by another mod) is a medkit: the toast says how many tokens it freed. Health is measured against the auto-compact threshold, which is read again after a model change. A warning comes once when health drops under 15%.
- **Rap sheet.** A new pane tab with the current wanted level and armor, busts, escapes, most wanted, medkits, tokens healed and stalled rides. History counts busts (429 rate-limit rows, one per window), medkits (`compact_boundary` rows) and outages (`api_error` rows) from your transcripts.
- **Chase spinner.** From four stars up the spinner switches to chase lines.
- **Prompt footer label.** The wanted level or the time you get out stays in sight next to the prompt (`SessionMode`), even with the band folded. It updates every 30 seconds.
- **`/vice wanted`** opens the rap sheet.
- **Settings:** `wanted` (on) and `sounds` (off): a siren at four stars and when busted, a chime for a medkit.
- **Icon** for the plugin directory, drawn from the mod's own scene code (`tools/icon.ts`).
- **Release check** `tools/ip-check.sh`: no names of the game or its studio in what ships.

### Changed

- **The band is shared.** Vice Code now draws its part of the band above the prompt and keeps what other mods draw below it.
- **Sounds are synthesized.** The radio loop and the effects are generated on your machine at first use; the plugin ships no audio files (the 828 KB WAV is gone). A radio the player refuses now says so.
- **Desktop SVGs animate** (`isInteractive`) with CSS that respects reduced motion.
- **State survives `/clear`, `/resume` and `/branch`.** The engine resets the mod's session state there; the mod now sets itself up again on `classic.SessionStart`. What the wanted system already announced lives in the plugin store, so it is not announced again, and the radio button matches a loop that is still playing. Two sessions open at once check the store before each reading, so one does not repeat the other's toasts. A new session takes over a bust only while it is still in force.
- **Limit readings are atomic.** A rejected request and the reading it causes give one bust and one siren, not two.
- **Counters live in session state**, so a hot reload no longer resets the street-talk cadence or the cost baseline.
- **Synthetic API-error rows** in transcripts are no longer counted as responses or as a "ride".
- The HUD drops values that are stale after a compaction or a reset instead of showing the old ones. Armor shows "—" until the first reading, and is hidden with the wanted system off.
- The stats pane in the terminal sizes its label column to the labels, so long values are not cut.
- "Longest chase" is now "Longest job", so it does not collide with the wanted chase.
- Manifest: version 1.0.2, author, homepage, repository, icon. The marketplace entry carries the same version.

## 0.1.0 — 2026-10-27

First MVP: loading card, HUD, Miami spinner, gear labels on tool rows, `/vice` stats pane with history import, radio.
