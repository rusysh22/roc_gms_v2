// Regenerates docs-site/public/og.png — the 1200x630 social-unfurl card for docs.intourney.id.
// Deliberately image-only (the InTourney lockup on paper with the brand-green rail): no text
// rendering, so the output has no system-font dependency and is byte-stable across machines.
// Run with `node scripts/generate-og.mjs` from docs-site/ after changing the brand assets.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const W = 1200
const H = 630
const RAIL = 20
const PAPER = '#ffffff'
const GREEN = '#118653'

const lockup = join(root, 'src/assets/brand-lockup.png')
const out = join(root, 'public/og.png')

const meta = await sharp(lockup).metadata()
const lockupW = 560
const lockupH = Math.round((lockupW * meta.height) / meta.width)

const resized = await sharp(lockup)
  .resize({ width: lockupW })
  .toBuffer()

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <rect width="${RAIL}" height="${H}" fill="${GREEN}"/>
  </svg>`,
)

await sharp(svg)
  .composite([{ input: resized, left: Math.round((W - lockupW) / 2 + RAIL / 2), top: Math.round((H - lockupH) / 2) }])
  .png()
  .toFile(out)

console.log(`wrote ${out} (${W}x${H})`)
