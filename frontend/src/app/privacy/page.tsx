import type { Metadata } from "next";
import Image from "next/image";
import { Mail, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Privacy Policy — Dine Connect",
  description: "How Dine Connect collects, uses, and protects data on the WhatsApp reservation platform.",
};

const LAST_UPDATED = "3 September 2026";
const CONTACT_EMAIL = "info@daaprimeprojects.com";

const SECTIONS = [
  { id: "who-we-are", title: "Who we are" },
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use-it", title: "How we use this information" },
  { id: "google-calendar", title: "Google Calendar integration" },
  { id: "who-we-share-with", title: "Who we share information with" },
  { id: "retention", title: "Data retention and deletion" },
  { id: "security", title: "Security" },
  { id: "your-rights", title: "Your rights" },
  { id: "changes", title: "Changes to this policy" },
] as const;

function BrandMark() {
  return (
    <a href="/" aria-label="Dine Connect home" className="flex items-center">
      <Image src="/logo.png" alt="DAAP DineConnect — Better Dining. Stronger Connection." width={193} height={60} className="w-auto" style={{ height: 60 }} />
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-line py-space-7 first:pt-0 last:border-0">
      <h2 className="mb-space-3 font-display text-[20px] font-bold text-ink-900">{title}</h2>
      <div className="space-y-space-3 text-body">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-space-3 border-b border-line bg-paper/90 px-space-4 py-space-4 backdrop-blur-sm md:px-space-7 lg:px-space-9">
        <BrandMark />
        <a href="/" className="text-[13.5px] font-semibold text-brand-600 hover:underline">
          Back to home
        </a>
      </header>

      <main className="mx-auto max-w-[1080px] px-space-4 py-space-8 md:px-space-7 lg:px-space-9">
        <div className="mb-space-8 max-w-[640px]">
          <p className="text-eyebrow mb-space-2">Legal</p>
          <h1 className="text-display-lg mb-space-2">Privacy Policy</h1>
          <p className="text-hint">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="grid grid-cols-1 gap-space-7 lg:grid-cols-[220px_1fr] lg:gap-space-9">
          <nav aria-label="Sections" className="hidden lg:block">
            <div className="sticky top-28 space-y-space-1">
              <p className="text-eyebrow mb-space-3">On this page</p>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-md px-space-3 py-space-2 text-[13px] text-ink-600 transition-colors duration-150 hover:bg-black/[0.04] hover:text-brand-600"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </nav>

          <Card className="p-space-6 md:p-space-8">
            <Section id="who-we-are" title="Who we are">
              <p>
                Dine Connect (&ldquo;we,&rdquo; &ldquo;us&rdquo;) is a WhatsApp-based
                table reservation booking and reminder platform built and operated by DaaPrime Tech, provided to
                restaurants and venues (&ldquo;Restaurants&rdquo;) so their guests can book, reschedule, and manage
                reservations directly on WhatsApp, and so restaurant staff can manage those reservations from a web
                dashboard.
              </p>
              <p>
                This policy explains what information we collect, how we use it, and the choices available to
                guests, restaurant staff, and other staff members who use Dine Connect.
              </p>
            </Section>

            <Section id="information-we-collect" title="Information we collect">
              <p>
                <strong className="text-ink-900">From guests, via WhatsApp:</strong> your phone number, name,
                and the reservation details you provide (section, table, date, time, and any reason or
                notes you share). We only collect what a message-driven reservation flow needs to actually book
                and remind you of your visit.
              </p>
              <p>
                <strong className="text-ink-900">From restaurant staff:</strong> the name, email address, and
                (hashed, never stored in plain text) password used to sign in to the restaurant dashboard, plus a
                record of the actions taken through that dashboard for audit purposes.
              </p>
              <p>
                <strong className="text-ink-900">From a restaurant admin who connects Google Calendar:</strong> a
                restaurant may connect one Google account (for the whole restaurant, not per table) for the optional
                Google Meet feature. When an admin does this, we receive an OAuth access token
                and refresh token from Google, and the email address of the connected Google account. These
                tokens are encrypted before they are stored — see &ldquo;Google Calendar integration&rdquo; below
                for exactly what this access is, and is not, used for.
              </p>
              <p>
                <strong className="text-ink-900">Documents:</strong> if a restaurant chooses to upload guest-
                related files through the dashboard, those files are stored on the restaurant&apos;s
                behalf.
              </p>
            </Section>

            <Section id="how-we-use-it" title="How we use this information">
              <ul className="list-disc space-y-space-2 pl-space-5">
                <li>To book, reschedule, cancel, and send reminders for reservations.</li>
                <li>To let restaurant staff view and manage their restaurant&apos;s own reservations and guests.</li>
                <li>To create a Google Calendar event with a Google Meet link for a booking, when the restaurant has connected a Google account.</li>
                <li>To maintain an audit trail of actions taken in the restaurant dashboard, for security and accountability.</li>
                <li>To operate, secure, and improve the platform itself.</li>
              </ul>
              <p>We do not sell guest or restaurant data, and we do not use it for advertising.</p>
            </Section>

            <Section id="google-calendar" title="Google Calendar integration">
              <Card className="flex items-start gap-space-3 border-brand-200 bg-brand-50 p-space-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
                <p className="text-[14px] text-ink-900">
                  Dine Connect&apos;s use and transfer of information received from Google APIs to any other app
                  will adhere to the{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.
                </p>
              </Card>
              <p className="mt-space-4">
                Specifically, when a restaurant admin connects a Google account on the restaurant&apos;s behalf:
              </p>
              <ul className="list-disc space-y-space-2 pl-space-5">
                <li>
                  We request access only to create calendar events (the{" "}
                  <code className="rounded bg-black/[0.05] px-1 py-0.5 text-[13px]">calendar.events</code> scope) —
                  we cannot read your Gmail, Drive, or any other Google data.
                </li>
                <li>
                  We create exactly one calendar event per such booking (across any table at that
                  restaurant), containing the reservation time and a Google Meet link. We do not read, list, or
                  otherwise access any of your other existing calendar events.
                </li>
                <li>
                  The connection can be revoked at any time from the restaurant admin&apos;s own Settings page inside
                  Dine Connect, or directly from your Google Account&apos;s{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    third-party access settings
                  </a>
                  .
                </li>
                <li>Disconnecting deletes the stored access/refresh tokens; it does not delete any calendar event already created.</li>
              </ul>
            </Section>

            <Section id="who-we-share-with" title="Who we share information with">
              <p>We use the following third-party services to operate Dine Connect, each only for the specific purpose below:</p>
              <ul className="list-disc space-y-space-2 pl-space-5">
                <li><strong className="text-ink-900">Meta (WhatsApp Business Platform)</strong> — to send and receive the WhatsApp messages that power the booking flow.</li>
                <li><strong className="text-ink-900">Google (Calendar API)</strong> — only for restaurants whose admin opts in, as described above.</li>
                <li><strong className="text-ink-900">Our hosting and database providers</strong> — to run the application and store data securely.</li>
              </ul>
              <p>We do not share guest or reservation data with any other third party, and never for marketing purposes.</p>
            </Section>

            <Section id="retention" title="Data retention and deletion">
              <p>
                We retain reservation and guest records for as long as needed to provide the service to your
                restaurant and to meet applicable record-keeping requirements. A guest may request
                deletion of their data at any time by messaging{" "}
                <strong className="text-ink-900">&ldquo;DELETE&rdquo;</strong> to the restaurant&apos;s WhatsApp
                number, or by contacting the restaurant directly.
              </p>
            </Section>

            <Section id="security" title="Security">
              <p>
                Passwords are hashed, never stored in plain text. Google Calendar access/refresh tokens are
                encrypted at rest. All traffic to and from Dine Connect is encrypted in transit (HTTPS). Access to
                a restaurant&apos;s data within the dashboard is scoped to that restaurant&apos;s own staff.
              </p>
            </Section>

            <Section id="your-rights" title="Your rights">
              <p>
                Depending on your location, you may have rights to access, correct, or delete your personal
                information, including under India&apos;s Digital Personal Data Protection Act, 2023. To exercise
                these rights, contact the restaurant you booked with, or reach us directly using the details below.
              </p>
            </Section>

            <Section id="changes" title="Changes to this policy">
              <p>
                We may update this policy from time to time. We will update the &ldquo;Last updated&rdquo; date
                above when we do. Continued use of Dine Connect after a change means you accept the updated policy.
              </p>
            </Section>
          </Card>
        </div>

        <Card className="mt-space-7 flex flex-col items-start gap-space-4 p-space-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-label mb-space-1">Questions about this policy or your data?</p>
            <p className="text-[13.5px] text-ink-600">We&apos;re happy to help — reach out any time.</p>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex shrink-0 items-center gap-space-2 rounded-md bg-brand-600 px-space-4 py-space-3 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-700"
          >
            <Mail size={16} />
            {CONTACT_EMAIL}
          </a>
        </Card>
      </main>
    </>
  );
}
