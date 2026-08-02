import type { CSSProperties } from 'react'

// Every event picks one of these 3 pre-tuned combinations instead of a free color picker - each
// remaps the same 3 semantic slots the whole design system already uses (green=primary/success,
// blue=secondary/informational, gold=live/accent), so no component needs to know a theme exists.
export type EventThemePresetKey = 'classic' | 'sunset' | 'ocean'

// AUDIT_UI_UX_CSS CSS-09: every preset's green (primary) and gold (accent) slot failed WCAG AA's
// 4.5:1 normal-text contrast against white/paper (green ~3.44-4.38:1, gold ~1.82-2.74:1) - each
// was darkened just enough to clear 4.5:1 with a small margin, same fix and same margin as the
// base tokens in tailwind.css (CSS-08). Blue passed in every preset already (6.55-11.5:1) and is
// untouched.
export const EVENT_THEME_PRESETS: Record<
  EventThemePresetKey,
  { label: string; description: string; colors: { green: string; blue: string; gold: string } }
> = {
  classic: {
    label: 'Classic',
    description: 'The default InTourney green, blue, and gold.',
    colors: { green: '#118653', blue: '#1b57c4', gold: '#976c14' },
  },
  sunset: {
    label: 'Sunset',
    description: 'Warm coral, plum, and amber.',
    colors: { green: '#c05324', blue: '#6d3fae', gold: '#916e03' },
  },
  ocean: {
    label: 'Ocean',
    description: 'Cool teal, navy, and coral.',
    colors: { green: '#0d8277', blue: '#1e3a5f', gold: '#bf5343' },
  },
}

export const DEFAULT_EVENT_THEME_PRESET: EventThemePresetKey = 'classic'

export const isEventThemePresetKey = (value: unknown): value is EventThemePresetKey =>
  typeof value === 'string' && value in EVENT_THEME_PRESETS

export const getEventThemePreset = (presetKey?: string | null) =>
  EVENT_THEME_PRESETS[isEventThemePresetKey(presetKey) ? presetKey : DEFAULT_EVENT_THEME_PRESET]

// CSS custom properties, meant to be set inline on a wrapper element - Tailwind v4's `@theme`
// block registers --color-green/--color-blue/--color-gold as real CSS variables (see
// src/app/(frontend)/tailwind.css), so every `bg-green`/`text-blue`/`bg-gold` utility already
// underneath this wrapper picks up the event's chosen palette automatically.
export const getEventThemeStyle = (presetKey?: string | null): CSSProperties => {
  const preset = getEventThemePreset(presetKey)
  return {
    '--color-green': preset.colors.green,
    '--color-blue': preset.colors.blue,
    '--color-gold': preset.colors.gold,
  } as CSSProperties
}
