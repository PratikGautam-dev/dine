import Image from "next/image";
import { CircleCheck, ListChecks, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhoneMockup } from "@/components/marketing/PhoneMockup";

const FEATURES = [
  { title: "No app for guests", desc: "Works directly on WhatsApp", Icon: CircleCheck },
  { title: "Simple & guided", desc: "Menu-driven booking that just works", Icon: ListChecks },
  { title: "Transparent pricing", desc: "Meta messaging charges may apply", Icon: Tag },
];

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  // The full logo lockup (mark + DAAP / DineConnect + tagline), as designed.
  const height = size === "sm" ? 60 : 84;
  return (
    <Image
      src="/logo.png"
      alt="DAAP DineConnect — Better Dining. Stronger Connection."
      width={Math.round(height * 3.21)}
      height={height}
      className="w-auto"
      style={{ height }}
      priority
    />
  );
}

export default function LandingPage() {
  return (
    <>
    {/* Top nav: brand mark left, restaurant login as a real button top-right
        -- previously just a small text link buried under the hero CTAs. */}
    <header className="flex flex-wrap items-center justify-between gap-space-3 px-space-4 py-space-4 md:px-space-7 lg:px-space-9">
      <a href="/" aria-label="Dine Connect home">
        <BrandMark size="sm" />
      </a>
      <div className="flex items-center gap-space-2">
        <Button href="/portal/login" variant="secondary" size="md">
          Restaurant login
        </Button>
      </div>
    </header>

    <main className="relative isolate overflow-hidden">
      <Image
        src="/homepage-bg.svg"
        alt=""
        fill
        priority
        aria-hidden
        className="-z-10 object-cover object-right"
      />
      {/* Readability wash: on narrow screens the photo runs full-bleed behind
          the text instead of sitting off to the side, so bump contrast back
          up over the copy without hiding the image entirely. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-paper via-paper/75 to-paper/10 md:from-paper/95 md:via-paper/55 md:to-transparent"
      />

      <div className="px-space-4 pt-space-2 pb-space-8 sm:pt-space-4 md:px-space-7 lg:px-space-9 lg:pt-space-5 lg:pb-space-9">
        <div className="grid grid-cols-1 items-center gap-space-7 lg:grid-cols-[1.15fr_0.85fr] lg:gap-space-9">
          <div>
            {/* Tagline */}
            <p className="mb-space-3 text-[14.5px] text-ink-600">
              WhatsApp Table Reservation &amp; Reminder Platform for Restaurants
            </p>

            {/* Heading */}
            <h1 className="text-display-lg mb-space-5 max-w-[650px]">
              Reservations on <span className="text-brand-600">WhatsApp</span>. Managed from one restaurant dashboard.
            </h1>

            {/* Description */}
            <p className="text-body mb-space-6 max-w-[620px]">
              Let guests book, reschedule and cancel table reservations through WhatsApp. Use this platform&apos;s own
              booking database, connect your existing restaurant system, or activate directly inside your restaurant
              POS.
            </p>

            {/* Feature row */}
            <div className="mb-space-7 flex flex-wrap gap-space-5">
              {FEATURES.map(({ title, desc, Icon }) => (
                <div key={title} className="flex flex-1 basis-40 items-start gap-space-3 py-space-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-success-tint text-success">
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <strong className="block text-[15px] text-ink-900">{title}</strong>
                    <span className="mt-space-1 block text-[13px] text-ink-600">{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs -- Restaurant login moved to the header button above,
                no longer duplicated here as a text link. */}
            <div className="flex flex-wrap gap-space-3">
              <Button href="/auth" variant="primary" size="lg">
                Set up your restaurant
              </Button>
              <Button
                href="mailto:info@daaprimeprojects.com?subject=Product%20Demo%20Request"
                variant="secondary"
                size="lg"
              >
                Request a product demo
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </main>

    <footer className="border-t border-line bg-paper">
      <div className="px-space-4 py-space-7 md:px-space-7 lg:px-space-9">
        <div className="flex flex-col gap-space-6 md:flex-row md:justify-between">
          <div className="max-w-[320px]">
            <BrandMark size="sm" />
            <p className="mt-space-3 text-[13px] text-ink-600">
              WhatsApp table reservation booking &amp; reminders for restaurants — no app for guests, managed from one
              dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-space-6 md:flex md:gap-space-9">
            <div>
              <p className="text-eyebrow mb-space-2">Product</p>
              <ul className="space-y-space-2 text-[13.5px] text-ink-600">
                <li>
                  <a href="/auth" className="hover:text-brand-600 hover:underline">
                    Set up your restaurant
                  </a>
                </li>
                <li>
                  <a href="/portal/login" className="hover:text-brand-600 hover:underline">
                    Restaurant login
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:info@daaprimeprojects.com?subject=Product%20Demo%20Request"
                    className="hover:text-brand-600 hover:underline"
                  >
                    Request a demo
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-eyebrow mb-space-2">Contact</p>
              <ul className="space-y-space-2 text-[13.5px] text-ink-600">
                <li>
                  <a href="mailto:info@daaprimeprojects.com" className="hover:text-brand-600 hover:underline">
                    info@daaprimeprojects.com
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-eyebrow mb-space-2">Legal</p>
              <ul className="space-y-space-2 text-[13.5px] text-ink-600">
                <li>
                  <a href="/privacy" className="hover:text-brand-600 hover:underline">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-brand-600 hover:underline">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-space-6 border-t border-line pt-space-4 text-[12.5px] text-ink-400">
          © {new Date().getFullYear()} Dine Connect. All rights reserved.
        </div>
      </div>
    </footer>
    </>
  );
}
