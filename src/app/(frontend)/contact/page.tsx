import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, ScrollText, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'How to reach the InTourney team for support, business questions, or privacy requests.',
  alternates: { canonical: '/contact' },
}

// Reuses the real WhatsApp sales number already live on the homepage's "Request a demo" CTA
// (src/app/(frontend)/page.tsx) - kept as one constant so both stay in sync.
const WHATSAPP_URL =
  'https://wa.me/6282331565773?text=' + encodeURIComponent('Hi, I have a question about InTourney.')

const CHANNELS = [
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    description: 'For general questions, demos, or quick help.',
    action: { label: 'Chat on WhatsApp', href: WHATSAPP_URL },
  },
  {
    icon: Mail,
    title: 'Support & Legal',
    description: 'For account, subscription, or Terms of Service questions.',
    action: { label: 'legal@intourney.id', href: 'mailto:legal@intourney.id' },
  },
  {
    icon: ShieldCheck,
    title: 'Data Privacy',
    description: 'For requests to access, correct, or delete personal data.',
    action: { label: 'privacy@intourney.id', href: 'mailto:privacy@intourney.id' },
  },
]

export default function ContactPage() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-12 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Contact Us</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Have a question?</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            Pick whichever channel fits best below. We&apos;ll get back to you as soon as we can.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
          {CHANNELS.map((channel) => (
            <Card key={channel.title} className="flex flex-col">
              <channel.icon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
              <CardTitle as="h3" className="mt-3">
                {channel.title}
              </CardTitle>
              <CardDescription className="mt-1">{channel.description}</CardDescription>
              <Button asChild size="sm" variant="secondary" className="mt-4">
                <a href={channel.action.href}>{channel.action.label}</a>
              </Button>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl text-center text-sm text-ink-soft">
          <p>
            See also{' '}
            <Link href="/terms" className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-2">
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
