import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/ogCard'
import { marketingShareCopy } from '@/lib/shareMessages'

// Default social card for the marketing site and any public page without its own opengraph-image.
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'InTourney - Hosting your tournament'

export default async function OpengraphImage() {
  const copy = marketingShareCopy()
  return renderOgCard({ eyebrow: copy.eyebrow, title: copy.title, subtitle: copy.description })
}
