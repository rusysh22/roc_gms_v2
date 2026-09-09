import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalLayout } from '@/components/legal-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'InTourney Privacy Policy: what data we collect and how we use it.',
  alternates: { canonical: '/privacy' },
}

const EFFECTIVE_DATE = 'September 9, 2026'

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <p>
          This Privacy Policy explains how InTourney (&quot;we&quot;) collects, uses, and protects
          personal data when you use the Service, in line with Indonesia&apos;s Law No. 27 of 2022 on
          Personal Data Protection (&quot;PDP Law&quot;). By using the Service, you agree to the
          practices described here - see also our <Link href="/terms">Terms of Service</Link>.
        </p>
      }
      sections={[
        {
          heading: 'Data We Collect',
          body: (
            <>
              <p>We collect the following data, depending on how you use the Service:</p>
              <ul>
                <li>
                  <strong>Account data</strong> - name, email address, and password (stored
                  encrypted) when you register; or name, email, and profile photo from your Google
                  account if you sign up via &quot;Sign in with Google&quot;.
                </li>
                <li>
                  <strong>Event and participant data</strong> - when you (as an organizer) create an
                  event, club, team, or participant, we store the data you enter, such as a
                  participant&apos;s name, identification number, email, phone number, photo,
                  gender, and a club or team&apos;s contact name/email.
                </li>
                <li>
                  <strong>Public registration forms</strong> - when someone registers for an event
                  through a public form, we store the registrant&apos;s name, contact details
                  (email/phone), roster member data, and the submitter&apos;s IP address to help
                  prevent abuse.
                </li>
                <li>
                  <strong>Quick Bracket (no account)</strong> - participant names you enter into a
                  bracket, and the bracket creator&apos;s IP address.
                </li>
                <li>
                  <strong>Subscription data</strong> - when you activate an Event Management license,
                  we store the subscription status and activation identifiers exchanged with
                  Berlanggan (berlanggan.web.id), our payment-processing partner; we do not store
                  your card or payment method details - that is handled entirely by Berlanggan.
                </li>
                <li>
                  <strong>Technical data</strong> - IP address, device/browser type, and pages
                  visited, collected automatically for security and analytics purposes (see the
                  Cookies & Analytics section).
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'How We Use Data',
          body: (
            <ul>
              <li>Providing and operating the Service&apos;s features (events, brackets, schedules, match results, public standings).</li>
              <li>Authenticating accounts and keeping the Service secure.</li>
              <li>Processing and validating Event Management subscription status.</li>
              <li>Communicating with you about your account, support, or policy changes.</li>
              <li>Preventing abuse, fraud, and violations of the Terms of Service.</li>
              <li>Analyzing site usage in aggregate to improve the Service.</li>
            </ul>
          ),
        },
        {
          heading: 'Sharing Data with Third Parties',
          body: (
            <>
              <p>We do not sell your personal data. We share data as necessary with:</p>
              <ul>
                <li>
                  <strong>Berlanggan (berlanggan.web.id)</strong> - for payment processing and
                  Event Management license activation, we send an account identifier (not your
                  password) to validate subscription status.
                </li>
                <li>
                  <strong>Google</strong> - if you choose &quot;Sign in with Google&quot;, Google
                  processes your authentication under its own privacy policy.
                </li>
                <li>
                  <strong>Hosting and infrastructure providers</strong> - the servers and databases
                  that run the Service.
                </li>
                <li>
                  <strong>Data you choose to make public</strong> - participant names, brackets,
                  schedules, and match results you publish on your event&apos;s public pages can be
                  viewed by anyone who accesses that link - this is a core function of the Service
                  (public tournament pages), not sharing with an unrelated third party beyond that.
                </li>
              </ul>
              <p>
                We may disclose data where required by applicable law, or to protect the rights,
                safety, and property of InTourney or its users.
              </p>
            </>
          ),
        },
        {
          heading: 'Data Storage & Security',
          body: (
            <p>
              Data is stored in databases we manage and protected with reasonable security practices
              (encrypted passwords, role-based access control). However, no system is completely risk
              -free; we cannot guarantee absolute security of data transmitted over the internet.
              Data is retained for as long as the related account or event remains active, or as
              needed to meet legal obligations.
            </p>
          ),
        },
        {
          heading: 'Your Rights',
          body: (
            <>
              <p>Under the PDP Law, you have the right to:</p>
              <ul>
                <li>Request access to and a copy of the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your account and personal data, except data we are required to retain for legal compliance.</li>
                <li>Withdraw your consent to certain processing, to the extent it is not otherwise legally required.</li>
              </ul>
              <p>
                To exercise these rights, contact us at{' '}
                <a href="mailto:privacy@intourney.id">privacy@intourney.id</a>. If you are a
                participant whose data was entered by an event organizer (rather than an account
                holder yourself), please contact the relevant organizer first, or contact us and we
                will help follow up.
              </p>
            </>
          ),
        },
        {
          heading: "Children's Data",
          body: (
            <p>
              The Service is not intended for children under 13 to hold an account. We recognize
              that participant data entered by organizers may include data about minors (for
              example, school-age sports competitors) - in that case, the event organizer is
              responsible for ensuring valid parental/guardian consent has been obtained before
              entering that data into the Service, as set out under &quot;Content and Data You
              Enter&quot; in our <Link href="/terms">Terms of Service</Link>.
            </p>
          ),
        },
        {
          heading: 'Cookies & Analytics',
          body: (
            <p>
              We use necessary session cookies to keep you signed in. Where enabled, we also use
              Google Analytics to understand aggregate site usage (for example, the most-visited
              pages) - we do not use this data to identify you individually. You can configure your
              browser to reject cookies, though some features of the Service may not work correctly
              without them.
            </p>
          ),
        },
        {
          heading: 'Changes to This Policy',
          body: (
            <p>
              We may update this Privacy Policy from time to time. Changes take effect as of the
              updated &quot;Effective date&quot; above. We encourage you to review this page
              periodically.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Privacy-related questions or requests can be sent to{' '}
              <a href="mailto:privacy@intourney.id">privacy@intourney.id</a>. See also{' '}
              <Link href="/contact">Contact Us</Link> for other channels.
            </p>
          ),
        },
      ]}
    />
  )
}
