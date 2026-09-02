import { readFileSync } from 'fs'
import { join } from 'path'

import opentype from 'opentype.js'
import sharp from 'sharp'

// Shared renderer for every co-located `opengraph-image` route (Open Graph + Twitter/X - what
// Facebook/Meta, WhatsApp, LinkedIn, Slack, Instagram DM previews, ... all read). One 1200x630
// card: the InTourney mark, a flexible kicker/title/subtitle, and the wordmark at the bottom.
// Copy comes from src/lib/shareMessages.ts so the wording stays consistent and tunable.
//
// Text is converted to vector <path> outlines with opentype.js (bundled Plus Jakarta Sans woff
// subsets) and the whole card is rasterised with sharp. This deliberately depends on NO system
// fonts and NOT on next/og (whose bundled encoder throws `colourspace: parameter space not set`
// on this toolchain) - so the output is byte-identical on a laptop and on a bare Alpine container.

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

const W = 1200
const H = 630
const PAD = 72
const RAIL = 20

const INK = '#0c231f'
const INK_SOFT = '#41564f'
const PAPER = '#ffffff'
const DEFAULT_ACCENT = '#118653'

const fontFile = (name: string) => join(process.cwd(), 'src/lib/og-fonts', name)
const parseFont = (name: string) => {
  const buf = readFileSync(fontFile(name))
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}
const FONT_TITLE = parseFont('jakarta-800.woff') // headline
const FONT_EYEBROW = parseFont('jakarta-700.woff') // kicker
const FONT_BODY = parseFont('jakarta-500.woff') // subtitle

type BrandAsset = { uri: string; w: number; h: number }
const loadAsset = (relPath: string): BrandAsset => {
  const buf = readFileSync(join(process.cwd(), relPath))
  return { uri: `data:image/png;base64,${buf.toString('base64')}`, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}
const ICON = loadAsset('public/brand/icon.png')
const WORDMARK = loadAsset('public/brand/wordmark.png')

type Font = ReturnType<typeof parseFont>

// `tracking` is opentype.js' per-mille letter-spacing (80 ≈ 0.08em).
const measure = (font: Font, text: string, size: number, tracking = 0) =>
  font.getAdvanceWidth(text, size, { tracking } as opentype.RenderOptions)

// `y` is the text baseline. Returns an SVG <path> element.
const textPath = (
  font: Font,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  tracking = 0,
) => {
  const path = font.getPath(text, x, y, size, { tracking, kerning: true } as opentype.RenderOptions)
  return `<path d="${path.toPathData(2)}" fill="${fill}"/>`
}

// Greedy word-wrap using real glyph advance widths. Overflow past `maxLines` gets an ellipsis.
const wrapByWidth = (
  font: Font,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] => {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(font, candidate, size) <= maxWidth || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)

  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1].replace(/[.,;:]+$/, '')
    while (last && measure(font, `${last}…`, size) > maxWidth) {
      last = last.slice(0, -1).trimEnd()
    }
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

const titleSize = (title: string) => {
  const len = title.length
  if (len <= 22) return 82
  if (len <= 40) return 66
  if (len <= 64) return 54
  return 46
}

export type OgCardInput = {
  eyebrow?: string
  title: string
  subtitle?: string
  /** Hex accent (event theme primary); defaults to InTourney green. */
  accent?: string
}

const buildSvg = ({ eyebrow, title, subtitle, accent = DEFAULT_ACCENT }: OgCardInput): string => {
  const contentW = 984
  const eyebrowText = eyebrow
    ? (eyebrow.length > 64 ? `${eyebrow.slice(0, 61)}…` : eyebrow).toUpperCase()
    : ''
  const tSize = titleSize(title)
  const titleLines = wrapByWidth(FONT_TITLE, title, tSize, contentW, 3)
  const subtitleLines = subtitle ? wrapByWidth(FONT_BODY, subtitle, 30, contentW, 2) : []

  const titleLineH = tSize * 1.16
  const subSize = 30
  const subLineH = 40

  // Block height (top of eyebrow cap -> subtitle baseline), used to vertically centre the text
  // between the top mark and the bottom wordmark.
  const blockH =
    (eyebrowText ? 24 + 26 : 0) +
    tSize +
    (titleLines.length - 1) * titleLineH +
    (subtitleLines.length ? 30 + (subtitleLines.length - 1) * subLineH + subSize : 0)
  const regionTop = 170
  const regionBottom = H - PAD - 42 - 28
  let y = Math.max(regionTop, (regionTop + regionBottom - blockH) / 2)

  const parts: string[] = [
    `<rect width="${W}" height="${H}" fill="${PAPER}"/>`,
    `<rect width="${RAIL}" height="${H}" fill="${accent}"/>`,
    `<image href="${ICON.uri}" x="${W - 350}" y="${H - 330}" width="460" height="${Math.round((460 * ICON.h) / ICON.w)}" opacity="0.05"/>`,
    `<image href="${ICON.uri}" x="${PAD}" y="60" width="110" height="${Math.round((110 * ICON.h) / ICON.w)}"/>`,
  ]

  if (eyebrowText) {
    y += 20 // cap top -> baseline
    parts.push(textPath(FONT_EYEBROW, eyebrowText, PAD, y, 23, accent, 90))
    y += 26 + tSize * 0.82 // gap + title ascent -> first title baseline
  } else {
    y += tSize * 0.82
  }

  for (const line of titleLines) {
    parts.push(textPath(FONT_TITLE, line, PAD, y, tSize, INK))
    y += titleLineH
  }

  if (subtitleLines.length) {
    y += 30 - titleLineH + tSize * 0.28 + subSize * 0.72 // gap + last descent + sub ascent
    for (const line of subtitleLines) {
      parts.push(textPath(FONT_BODY, line, PAD, y, subSize, INK_SOFT))
      y += subLineH
    }
  }

  const wmH = 42
  const wmW = Math.round((wmH * WORDMARK.w) / WORDMARK.h)
  parts.push(
    `<image href="${WORDMARK.uri}" x="${PAD}" y="${H - PAD - wmH}" width="${wmW}" height="${wmH}"/>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`
}

export async function renderOgCard(input: OgCardInput): Promise<Response> {
  const png = await sharp(Buffer.from(buildSvg(input))).png().toBuffer()
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': OG_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
