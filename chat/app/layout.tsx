import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Editorial type system (see app/globals.css @theme): Fraunces for display,
// Hanken Grotesk for body, Spline Sans Mono for tabular numerals. next/font
// self-hosts each and exposes a CSS variable the @theme font tokens point at.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700"],
});

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-spline-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "iofund-agent",
  description: "Personal AI assistant over an I/O Fund subscription.",
};

// Applies the saved theme (or the OS preference, falling back to warm-dark)
// to <html> before first paint, so the toggle never flashes the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${hanken.variable} ${splineMono.variable}`}
    >
      <head>
        {/* Pre-paint theme bootstrap. suppressHydrationWarning because some
            browser extensions (ad/VAST blockers) rewrite inline <script> tags
            before React hydrates, which would otherwise log a false mismatch. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
