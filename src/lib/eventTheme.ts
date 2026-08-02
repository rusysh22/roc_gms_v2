import type { CSSProperties } from 'react'

// Every event picks one of these 3 pre-tuned combinations instead of a free color picker.
//
// AUDIT_UI_UX_CSS CSS-06/CSS-07: this used to remap --color-green/--color-blue/--color-gold
// directly - the same 3 variables StatusBadge and every other semantic-status usage rely on for a
// FIXED meaning (green=won/success, gold=live/attention, blue=scheduled/info), so choosing the
// "Ocean" preset turned live-match badges coral/red instead of gold. Presets now target their own
// --color-brand-primary/secondary/accent tokens (tailwind.css) - components that want to reflect
// the event's chosen palette (the hero CTA, accent icons/links, active tab pills) opt into those
// explicitly; everything using plain green/blue/gold keeps its meaning regardless of theme.
export type EventThemePresetKey = 'classic' | 'sunset' | 'ocean'

// AUDIT_UI_UX_CSS CSS-09: every preset's primary and accent slot failed WCAG AA's 4.5:1
// normal-text contrast against white/paper (primary ~3.44-4.38:1, accent ~1.82-2.74:1) - each was
// darkened just enough to clear 4.5:1 with a small margin, same fix and same margin as the base
// tokens in tailwind.css (CSS-08). Secondary passed in every preset already (6.55-11.5:1) and is
// untouched.
export const EVENT_THEME_PRESETS: Record<
  EventThemePresetKey,
  { label: string; description: string; colors: { primary: string; secondary: string; accent: string } }
> = {
  classic: {
    label: 'Classic',
    description: 'The default InTourney green, blue, and gold.',
    colors: { primary: '#118653', secondary: '#1b57c4', accent: '#976c14' },
  },
  sunset: {
    label: 'Sunset',
    description: 'Warm coral, plum, and amber.',
    colors: { primary: '#c05324', secondary: '#6d3fae', accent: '#916e03' },
  },
  ocean: {
    label: 'Ocean',
    description: 'Cool teal, navy, and coral.',
    colors: { primary: '#0d8277', secondary: '#1e3a5f', accent: '#bf5343' },
  },
}

export const DEFAULT_EVENT_THEME_PRESET: EventThemePresetKey = 'classic'

export const isEventThemePresetKey = (value: unknown): value is EventThemePresetKey =>
  typeof value === 'string' && value in EVENT_THEME_PRESETS

export const getEventThemePreset = (presetKey?: string | null) =>
  EVENT_THEME_PRESETS[isEventThemePresetKey(presetKey) ? presetKey : DEFAULT_EVENT_THEME_PRESET]

// CSS custom properties, meant to be set inline on a wrapper element - Tailwind v4's `@theme`
// block registers --color-brand-primary/secondary/accent as real CSS variables (see
// src/app/(frontend)/tailwind.css), so every `bg-brand-primary`/`text-brand-secondary`/
// `bg-brand-accent` utility already underneath this wrapper picks up the event's chosen palette
// automatically. Deliberately does NOT touch --color-green/--color-blue/--color-gold anymore.
export const getEventThemeStyle = (presetKey?: string | null): CSSProperties => {
  const preset = getEventThemePreset(presetKey)
  return {
    '--color-brand-primary': preset.colors.primary,
    '--color-brand-secondary': preset.colors.secondary,
    '--color-brand-accent': preset.colors.accent,
  } as CSSProperties
}
