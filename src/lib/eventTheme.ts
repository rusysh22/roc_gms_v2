import type { CSSProperties } from 'react'

// Every event picks one of these 3 pre-tuned combinations instead of a free color picker - each
// remaps the same 3 semantic slots the whole design system already uses (green=primary/success,
// blue=secondary/informational, gold=live/accent), so no component needs to know a theme exists.
export type EventThemePresetKey = 'classic' | 'sunset' | 'ocean'

export const EVENT_THEME_PRESETS: Record<
  EventThemePresetKey,
  { label: string; description: string; colors: { green: string; blue: string; gold: string } }
> = {
  classic: {
    label: 'Classic',
    description: 'The default ROC GMS green, blue, and gold.',
    colors: { green: '#128a56', blue: '#1b57c4', gold: '#de9f1e' },
  },
  sunset: {
    label: 'Sunset',
    description: 'Warm coral, plum, and amber.',
    colors: { green: '#e2622a', blue: '#6d3fae', gold: '#f2b705' },
  },
  ocean: {
    label: 'Ocean',
    description: 'Cool teal, navy, and coral.',
    colors: { green: '#0f9b8e', blue: '#1e3a5f', gold: '#ff6f59' },
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
