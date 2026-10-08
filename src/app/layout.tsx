import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

// Plus Jakarta Sans: a warm, slightly rounded geometric sans for display/
// headings -- distinct from the Inter/Geist "safe default" look, still reads
// as clean and modern rather than quirky. IBM Plex Sans for body/UI text:
// excellent legibility at small sizes (dashboards, tables, form labels), a
// bit more technical/precise than Jakarta, which is exactly the contrast a
// display/body pairing wants.
const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Dine Connect — WhatsApp Table Reservation & Reminder Platform for Restaurants",
  description:
    "Let guests book, reschedule and cancel table reservations through WhatsApp, managed from one restaurant dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <head>
        {/* Storefront-only (src/app/(storefront)/order/storefront-tokens.css's .material-symbols-outlined
            rules), but loaded here because nested App Router layouts can't inject into <head> --
            an external stylesheet link costs nothing on portal pages that never reference the class. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
