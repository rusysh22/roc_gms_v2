import { Card, CardTitle } from '@/components/ui/card'

// AUDIT_UI_UX_CSS PUB-10/P2 item 5: sponsors get top billing (larger logo, own row) for
// title/gold tiers, everyone else shares a smaller grid - matches how sponsorship tiers are
// normally sold (a title sponsor paid for prominence, a "partner" tier didn't).
export type SponsorDoc = {
  id: string | number
  name: string
  tier: string
  website_url?: string | null
  logo?: { url?: string; alt?: string } | string | number | null
}

const getLogoUrl = (sponsor: SponsorDoc) =>
  sponsor.logo && typeof sponsor.logo === 'object' ? (sponsor.logo as { url?: string }).url : undefined

function SponsorMark({ sponsor, large }: { sponsor: SponsorDoc; large?: boolean }) {
  const logoUrl = getLogoUrl(sponsor)
  const content = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions
    <img
      src={logoUrl}
      alt={sponsor.name}
      className={large ? 'h-16 w-auto object-contain' : 'h-10 w-auto object-contain'}
    />
  ) : (
    <span className={large ? 'text-lg font-extrabold text-ink' : 'text-sm font-bold text-ink'}>
      {sponsor.name}
    </span>
  )

  return sponsor.website_url ? (
    <a
      href={sponsor.website_url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center justify-center rounded-card p-3 grayscale transition-all hover:grayscale-0"
      aria-label={sponsor.name}
    >
      {content}
    </a>
  ) : (
    <div className="flex items-center justify-center p-3">{content}</div>
  )
}

export function SponsorStrip({ sponsors }: { sponsors: SponsorDoc[] }) {
  if (sponsors.length === 0) return null

  const titleAndGold = sponsors.filter((s) => s.tier === 'title' || s.tier === 'gold')
  const rest = sponsors.filter((s) => s.tier !== 'title' && s.tier !== 'gold')

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Sponsors &amp; Partners</CardTitle>
      {titleAndGold.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-6 border-b border-line pb-4">
          {titleAndGold.map((sponsor) => (
            <SponsorMark key={sponsor.id} sponsor={sponsor} large />
          ))}
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-4">
          {rest.map((sponsor) => (
            <SponsorMark key={sponsor.id} sponsor={sponsor} />
          ))}
        </div>
      ) : null}
    </Card>
  )
}
