import type { Metadata } from 'next'
import Link from 'next/link'
import { GitBranch, MessageCircle, ShieldCheck, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Tentang Kami',
  description: 'Tentang InTourney - platform untuk merencanakan dan menjalankan turnamen multi-cabang olahraga.',
  alternates: { canonical: '/about' },
}

const VALUES = [
  {
    icon: Zap,
    title: 'Cepat digunakan',
    description: 'Dari Quick Bracket tanpa akun sampai event penuh, panitia bisa langsung jalan tanpa training panjang.',
  },
  {
    icon: GitBranch,
    title: 'Alur turnamen yang benar',
    description: 'Bagan, jadwal, dan hasil pertandingan mengikuti aturan format turnamen yang sesungguhnya digunakan panitia.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparan ke peserta',
    description: 'Halaman publik event, jadwal, dan papan klasemen bisa diakses siapa saja tanpa perlu login.',
  },
]

export default function AboutPage() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-12 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Tentang Kami</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Kami membantu panitia menjalankan turnamen</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            InTourney dibangun untuk panitia turnamen multi-cabang olahraga dan games - mulai dari
            membuat event dan mengimpor peserta, menyusun bagan dan jadwal, sampai operasional hari
            pertandingan, hasil, klasemen, tabel medali, dan situs publik untuk event Anda.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {VALUES.map((value) => (
            <Card key={value.title}>
              <value.icon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
              <CardTitle as="h3" className="mt-3">
                {value.title}
              </CardTitle>
              <CardDescription className="mt-1">{value.description}</CardDescription>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-card border border-line bg-mist p-6 text-sm leading-relaxed text-ink-soft">
          <h2 className="text-base font-extrabold text-ink">Siapa yang menjalankan InTourney</h2>
          <p className="mt-2">
            InTourney saat ini dikelola oleh perseorangan (belum berbentuk badan hukum) sebagai
            pengelola platform. Fitur Quick Bracket Tournament tetap gratis dan tanpa akun sebagai
            cara tercepat mencoba layanan; area Event Management berbayar untuk mendukung
            pengembangan dan operasional layanan secara berkelanjutan - lihat{' '}
            <Link href="/pricing" className="font-semibold text-ink underline underline-offset-2">
              Pricing
            </Link>
            .
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/quick-bracket/new">Coba Quick Bracket</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/contact">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Hubungi Kami
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
