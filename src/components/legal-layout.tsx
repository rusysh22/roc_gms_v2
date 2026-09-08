import * as React from 'react'
import Link from 'next/link'

export interface LegalSection {
  heading: string
  body: React.ReactNode
}

/**
 * Shared chrome for /terms and /privacy: eyebrow + title + "last updated" + a linked table of
 * contents, then each section rendered as its own <section> so in-page anchors work. Kept as one
 * component (not copy-pasted) since both pages share the exact same structural contract.
 */
export function LegalLayout({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string
  effectiveDate: string
  intro: React.ReactNode
  sections: LegalSection[]
}) {
  const slugify = (heading: string) =>
    heading
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-12 pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Dokumen Legal</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">Berlaku efektif: {effectiveDate}</p>
          <div className="mt-6 text-sm leading-relaxed text-ink-soft">{intro}</div>

          <nav aria-label="Daftar isi" className="mt-8 rounded-card border border-line bg-mist p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Daftar Isi</p>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {sections.map((section, index) => (
                <li key={section.heading}>
                  <Link
                    href={`#${slugify(section.heading)}`}
                    className="text-sm font-semibold text-ink no-underline hover:underline"
                  >
                    {index + 1}. {section.heading}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 flex flex-col gap-10">
            {sections.map((section, index) => (
              <section key={section.heading} id={slugify(section.heading)} className="scroll-mt-20">
                <h2 className="text-lg font-extrabold text-ink">
                  {index + 1}. {section.heading}
                </h2>
                <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-soft [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
