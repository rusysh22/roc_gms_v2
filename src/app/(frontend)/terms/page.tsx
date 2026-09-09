import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalLayout } from '@/components/legal-layout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for using InTourney.',
  alternates: { canonical: '/terms' },
}

const EFFECTIVE_DATE = 'September 9, 2026'

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <p>
          These Terms govern your use of InTourney (the &quot;Service&quot;), including the public
          website, Quick Bracket Tournament, and the Event Management area at{' '}
          <code>/workspaces</code>. By accessing or using the Service, you agree to these Terms. If
          you do not agree, please do not use the Service.
        </p>
      }
      sections={[
        {
          heading: 'About the Service Provider',
          body: (
            <p>
              InTourney is currently owned and operated by an individual (not yet incorporated as a
              limited liability company) acting as the platform provider (&quot;we&quot;, &quot;the
              InTourney operator&quot;). Legal questions about the Service can be sent to{' '}
              <a href="mailto:legal@intourney.id">legal@intourney.id</a>.
            </p>
          ),
        },
        {
          heading: 'Acceptance of Terms',
          body: (
            <p>
              You must be at least 18 years old, or use the Service with the permission and
              supervision of a parent or guardian, to create an Event Management account. Quick
              Bracket Tournament can be used without creating an account, as described in section 4.
            </p>
          ),
        },
        {
          heading: 'User Accounts',
          body: (
            <>
              <p>
                When you register with an email/password or Google Sign-In, you are responsible for
                keeping your account credentials confidential and for all activity that occurs under
                your account. Notify us promptly at{' '}
                <a href="mailto:legal@intourney.id">legal@intourney.id</a> if you suspect
                unauthorized use of your account.
              </p>
              <p>
                New accounts automatically receive the &quot;Event Admin&quot; role, letting you
                create and manage your own events. We may suspend or terminate accounts that violate
                these Terms.
              </p>
            </>
          ),
        },
        {
          heading: 'Quick Bracket Tournament (No Login Required)',
          body: (
            <p>
              Quick Bracket lets you generate a tournament bracket without an account. Brackets
              created this way are temporary and are automatically expired/deleted after a set
              period, unless you claim them into a full event by creating an account. We log the
              creator&apos;s IP address for abuse-prevention purposes (see our{' '}
              <Link href="/privacy">Privacy Policy</Link>).
            </p>
          ),
        },
        {
          heading: 'Content and Data You Enter',
          body: (
            <>
              <p>
                As an event organizer, you may enter other people&apos;s data into the Service - for
                example club, team, and participant/athlete names (including names, emails, phone
                numbers, photos, or other contact details) - either manually or via Excel import. You
                represent and warrant that you have the lawful right and permission to enter and
                manage that data within the Service, including consent from the individuals whose
                data you enter where required by applicable law.
              </p>
              <p>
                You are solely responsible for the accuracy and legality of content you upload, and
                agree not to upload content that is unlawful, hateful, or that infringes the rights
                of any third party.
              </p>
            </>
          ),
        },
        {
          heading: 'Subscription, Payment & Refunds',
          body: (
            <>
              <p>
                Access to the Event Management area (<code>/workspaces</code>) requires an active
                subscription. Plans and pricing are shown live on the{' '}
                <Link href="/pricing">Pricing</Link> page, matching whatever products we make
                available.
              </p>
              <p>
                <strong>Payment is processed by a third party, Berlanggan (berlanggan.web.id)</strong>{' '}
                (&quot;Berlanggan&quot;), which acts as an independent billing and license-activation
                provider separate from InTourney. When you choose a plan, you will be taken to
                Berlanggan&apos;s own checkout page to complete payment; their own payment terms,
                payment methods, and policies also apply to that transaction. Once payment succeeds,
                you will receive a license key, which you activate on the{' '}
                <Link href="/subscribe">Subscribe</Link> page to link it to your InTourney account.
              </p>
              <p>
                A license key can only be activated on one InTourney account at a time. Your
                subscription status (active, grace period, expired, revoked, or suspended) is
                periodically re-validated against Berlanggan&apos;s system.
              </p>
              <p>
                Refund requests follow the policy in effect on Berlanggan, as the payment provider.
                For activation issues, an incorrectly linked license, or a billing dispute related to
                your use of the InTourney Service, contact us at{' '}
                <a href="mailto:legal@intourney.id">legal@intourney.id</a> and we will help direct
                you to the right process.
              </p>
            </>
          ),
        },
        {
          heading: 'Prohibited Uses',
          body: (
            <ul>
              <li>Misusing, hacking, or disrupting the Service&apos;s operation.</li>
              <li>Collecting other users&apos; data without permission (scraping, harvesting).</li>
              <li>Uploading illegal, misleading content, or content that infringes another party&apos;s intellectual property.</li>
              <li>Using the Service to defraud tournament participants.</li>
              <li>Attempting to gain unauthorized access to accounts, events, or data belonging to others.</li>
            </ul>
          ),
        },
        {
          heading: 'Intellectual Property',
          body: (
            <p>
              The &quot;InTourney&quot; name, logo, and the Service&apos;s user interface are owned
              by the InTourney operator. Content you upload remains yours or its original
              owner&apos;s; by uploading it, you grant us a limited license to store and display it
              to the extent necessary to operate the Service (for example, displaying brackets and
              schedules on your event&apos;s public pages).
            </p>
          ),
        },
        {
          heading: 'Limitation of Liability',
          body: (
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind, express or
              implied. To the fullest extent permitted by applicable law, the InTourney operator is
              not liable for indirect, incidental, or consequential damages arising from your use of,
              or inability to use, the Service, including but not limited to losses from tournament
              disruption, data loss, or failed third-party transactions (including Berlanggan).
            </p>
          ),
        },
        {
          heading: 'Termination',
          body: (
            <p>
              We may suspend or terminate your access to the Service if you violate these Terms, or
              discontinue part or all of the Service at any time with reasonable notice where
              practicable. You may stop using the Service and request account deletion at any time
              via <a href="mailto:legal@intourney.id">legal@intourney.id</a>.
            </p>
          ),
        },
        {
          heading: 'Changes to These Terms',
          body: (
            <p>
              We may update these Terms from time to time. Changes take effect as of the updated
              &quot;Effective date&quot; above. Continued use of the Service after a change means you
              accept the updated Terms.
            </p>
          ),
        },
        {
          heading: 'Governing Law',
          body: (
            <p>
              These Terms are governed by and construed in accordance with the laws of the Republic
              of Indonesia, including but not limited to Law No. 11 of 2008 on Electronic Information
              and Transactions as amended by Law No. 19 of 2016, Law No. 8 of 1999 on Consumer
              Protection, and Law No. 27 of 2022 on Personal Data Protection.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about these Terms can be sent to{' '}
              <a href="mailto:legal@intourney.id">legal@intourney.id</a>. See also{' '}
              <Link href="/contact">Contact Us</Link> for other channels.
            </p>
          ),
        },
      ]}
    />
  )
}
