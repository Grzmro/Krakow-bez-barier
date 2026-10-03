import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { Providers } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: pl.app.name,
  description: pl.app.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${inter.variable} ${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-ink-foreground"
        >
          {pl.layout.skipToContent}
        </a>
        <header className="bg-blush-container px-4 py-1.5 text-center text-caption font-semibold">
          <p role="note">{pl.layout.sampleBanner}</p>
        </header>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
