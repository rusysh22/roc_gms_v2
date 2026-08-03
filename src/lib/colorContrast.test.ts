import { describe, expect, it } from 'vitest'

import { contrastRatio } from './colorContrast'
import { EVENT_THEME_PRESETS } from './eventTheme'

// AUDIT_UI_UX_CSS CSS-08/CSS-09 reconciliation: colors were darkened to clear WCAG AA's 4.5:1
// normal-text minimum after a manual audit caught the regression - nothing since then would catch
// it happening again (e.g. someone nudging a hex value a shade brighter for "vibrancy"). This is
// that guard. BASE_TOKENS mirrors tailwind.css's `@theme` block (CSS custom properties can't be
// imported into a Vitest/Node test directly) - if you change a base token's hex value there, update
// it here too. Event theme preset colors are NOT duplicated - EVENT_THEME_PRESETS is imported
// directly from eventTheme.ts, which is already the single source of truth for those.
const BASE_TOKENS = {
  paper: '#ffffff',
  mist: '#f1f7f4',
  ink: '#0c231f',
  inkSoft: '#41564f',
  green: '#118653',
  blue: '#1b57c4',
  gold: '#976c14',
  danger: '#b91c1c',
  dangerSurface: '#fef2f2',
}

const AA_NORMAL_TEXT_MINIMUM = 4.5

describe('base design token contrast (CSS-08)', () => {
  const pairs: Array<[string, string, string]> = [
    ['ink on paper (body text)', BASE_TOKENS.ink, BASE_TOKENS.paper],
    ['ink on mist (body text)', BASE_TOKENS.ink, BASE_TOKENS.mist],
    ['ink-soft on paper (secondary text)', BASE_TOKENS.inkSoft, BASE_TOKENS.paper],
    ['ink-soft on mist (secondary text)', BASE_TOKENS.inkSoft, BASE_TOKENS.mist],
    ['green on paper (status/link text)', BASE_TOKENS.green, BASE_TOKENS.paper],
    ['blue on paper (status/link text)', BASE_TOKENS.blue, BASE_TOKENS.paper],
    ['gold on paper (status text)', BASE_TOKENS.gold, BASE_TOKENS.paper],
    ['danger on paper (error text)', BASE_TOKENS.danger, BASE_TOKENS.paper],
    ['danger on danger-surface (error banner text)', BASE_TOKENS.danger, BASE_TOKENS.dangerSurface],
    ['paper on green (primary button text)', BASE_TOKENS.paper, BASE_TOKENS.green],
    ['paper on danger (destructive button text)', BASE_TOKENS.paper, BASE_TOKENS.danger],
  ]

  it.each(pairs)('%s meets WCAG AA 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MINIMUM)
  })
})

describe('event theme preset contrast (CSS-09)', () => {
  const cases = Object.entries(EVENT_THEME_PRESETS).flatMap(
    ([key, preset]) =>
      [
        [`${key} primary text on paper`, preset.colors.primary, BASE_TOKENS.paper],
        [`${key} secondary text on paper`, preset.colors.secondary, BASE_TOKENS.paper],
        [`${key} accent text on paper`, preset.colors.accent, BASE_TOKENS.paper],
        [`${key} button text (paper) on primary`, BASE_TOKENS.paper, preset.colors.primary],
      ] as Array<[string, string, string]>,
  )

  it.each(cases)('%s meets WCAG AA 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MINIMUM)
  })
})
