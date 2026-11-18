// The look: the app's own colors, tuned to the scene. Violet stock, pink accent, an
// orange warning: the hues of a coastal sunset, in a light version and a dark one.
// The desktop and mobile apps paint it; the terminal and editors keep their own colors.

import type { ThemeColors } from 'claude-code'

import { makeColors } from '../make-colors.js'

/** Meaning stays where the app has it: danger is a red, success a green, warning an amber. */
const ROLES = { accent: '#f0468c', danger: '#e5484d', success: '#2fb894', warning: '#f09a3e', pro: '#a878f0' }

/** `surface-0` of each mode is the stock the scene prints on (tiles.ts, PAGE). */
const LIGHT = {
  gray: {
    anchors: {
      'surface-0': '#f3e6e4',
      'surface-1': '#f8eeec',
      'surface-2': '#fcf6f4',
      'text-primary': '#2a1a30',
      'text-secondary': '#523d5c',
      'text-muted': '#6b5675',
    },
  },
}

const DARK = {
  gray: {
    anchors: {
      'surface-0': '#140e22',
      'surface-1': '#1a132c',
      'surface-2': '#201836',
      'surface-3': '#241b3c',
      'text-primary': '#f5edf7',
      'text-secondary': '#cfc2dd',
      'text-muted': '#a999bb',
    },
  },
}

export type Look = { colors: ThemeColors; problems: readonly string[] }

let made: Look | null = null

/**
 * The colors, always in both modes. The desktop app keeps the window's own mode whatever
 * a look asks for, so a look that gave one mode alone would leave the other window with
 * no colors of ours at all.
 */
export function look(): Look {
  if (made) return made
  const { theme, problems } = makeColors({ label: 'Vice Code', roles: ROLES, light: LIGHT, dark: DARK })
  made = { colors: theme, problems }
  return made
}

/** The line that would stop the desktop app painting the look, if there is one. */
export function unpainted(): string | undefined {
  return look().problems.find(line => line.startsWith("Desktop won't paint"))
}
