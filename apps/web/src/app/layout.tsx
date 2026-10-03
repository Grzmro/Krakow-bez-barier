import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { LiveRegionProvider, Providers, Toaster } from "@krakow-bez-barier/ui";
import { SampleBanner } from "@/components/kbb";
import { AppHeader } from "@/components/layout/app-header";
import { pl } from "@/i18n/pl";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: pl.common.app.name,
  description: pl.common.app.description,
};

// Pages render their own <main id="main" tabIndex={-1}> — the skip link targets it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${inter.variable} ${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-ink-foreground"
        >
          {pl.common.layout.skipToContent}
        </a>
        <SampleBanner />
        <Providers>
          <LiveRegionProvider>
            <AppHeader />
            {children}
            <Toaster />
          </LiveRegionProvider>
        </Providers>
      </body>
    </html>
  );
}
