import { readFileSync } from 'fs'
import { join } from 'path'

import sharp from 'sharp'

// Shared renderer for every co-located `opengraph-image` route (Open Graph + Twitter/X - what
// Facebook/Meta, WhatsApp, LinkedIn, Slack, Instagram DM previews, ... all read). One 1200x630
// card: the InTourney mark, a flexible kicker/title/subtitle, and the wordmark at the bottom.
// Copy comes from src/lib/shareMessages.ts so the wording stays consistent and tunable.
//
// Built with `sharp` (already a project dependency, used for the favicons) rather than next/og:
// on this toolchain next/og's bundled encoder throws on raw-buffer PNGs, and sharp's SVG
// rasteriser is rock-solid here.

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

const W = 1200
const H = 630
const PAD = 72

const INK = '#0c231f'
const INK_SOFT = '#41564f'
const PAPER = '#ffffff'
const DEFAULT_ACCENT = '#118653'
// 'DejaVu Sans' is listed first as the reliable server-side fallback (bundled into the Docker
// image via `apk add font-dejavu`); desktop dev falls through to the platform UI sans.
const FONT_STACK =
  "'Plus Jakarta Sans','Segoe UI',Roboto,'Helvetica Neue',Arial,'DejaVu Sans','Noto Sans',sans-serif"

type BrandAsset = { uri: string; w: number; h: number }

const loadAsset = (relPath: string): BrandAsset => {
  const buf = readFileSync(join(process.cwd(), relPath))
  // PNG: width @16..20, height @20..24 (big-endian) in the IHDR chunk.
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  return { uri: `data:image/png;base64,${buf.toString('base64')}`, w, h }
}
const ICON = loadAsset('public/brand/icon.png')
const WORDMARK = loadAsset('public/brand/wordmark.png')

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  )

// Greedy word-wrap using an average glyph-width estimate (no font metrics available to the SVG
// rasteriser, so this stays deliberately conservative). Overflow past `maxLines` gets an ellipsis.
const wrap = (text: string, fontSize: number, maxWidth: number, maxLines: number): string[] => {
  const perLine = Math.max(8, Math.floor(maxWidth / (fontSize * 0.56)))
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= perLine || !current) {
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
    const last = lines[lines.length - 1].replace(/[.,;:]+$/, '')
    lines[lines.length - 1] =
      last.length > perLine - 1 ? `${last.slice(0, perLine - 1).trimEnd()}…` : `${last}…`
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
  const contentW = W - PAD * 2 - 20 /* accent rail */

  const tSize = titleSize(title)
  const titleLines = wrap(title, tSize, contentW, 3)
  const subtitleLines = subtitle ? wrap(subtitle, 30, contentW, 2) : []

  // Vertically centre the text block between the top mark and the bottom wordmark.
  const blockH =
    (eyebrow ? 34 : 0) + titleLines.length * tSize * 1.08 + (subtitleLines.length ? 22 + subtitleLines.length * 40 : 0)
  let y = Math.max(224, (H - blockH) / 2)

  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`)
  parts.push(`<rect width="20" height="${H}" fill="${accent}"/>`)
  // faint oversized watermark of the mark
  parts.push(
    `<image href="${ICON.uri}" x="${W - 360}" y="${H - 330}" width="470" height="${Math.round((470 * ICON.h) / ICON.w)}" opacity="0.05"/>`,
  )
  // top mark
  parts.push(`<image href="${ICON.uri}" x="${PAD}" y="64" width="112" height="${Math.round((112 * ICON.h) / ICON.w)}"/>`)

  if (eyebrow) {
    parts.push(
      `<text x="${PAD}" y="${y}" font-family="${FONT_STACK}" font-size="24" font-weight="700" letter-spacing="2" fill="${accent}">${escapeXml(
        eyebrow.length > 72 ? `${eyebrow.slice(0, 69)}…` : eyebrow,
      ).toUpperCase()}</text>`,
    )
    y += 34
  }

  y += tSize * 0.85
  for (const line of titleLines) {
    parts.push(
      `<text x="${PAD}" y="${y}" font-family="${FONT_STACK}" font-size="${tSize}" font-weight="800" fill="${INK}">${escapeXml(line)}</text>`,
    )
    y += tSize * 1.08
  }

  if (subtitleLines.length) {
    y += 22
    for (const line of subtitleLines) {
      parts.push(
        `<text x="${PAD}" y="${y}" font-family="${FONT_STACK}" font-size="30" font-weight="500" fill="${INK_SOFT}">${escapeXml(line)}</text>`,
      )
      y += 40
    }
  }

  // bottom wordmark
  const wmH = 44
  const wmW = Math.round((wmH * WORDMARK.w) / WORDMARK.h)
  parts.push(`<image href="${WORDMARK.uri}" x="${PAD}" y="${H - PAD - wmH}" width="${wmW}" height="${wmH}"/>`)

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
