const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

// WCAG 2.x relative luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG 2.x contrast ratio: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
export const contrastRatio = (hexA: string, hexB: string): number => {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB))
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB))
  return (lighter + 0.05) / (darker + 0.05)
}
