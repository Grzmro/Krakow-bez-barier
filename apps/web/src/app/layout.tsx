import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { LiveRegionProvider, Providers, Toaster } from "@krakow-bez-barier/ui";
import { AppSampleBanner } from "@/components/layout/app-sample-banner";
import { AppHeader } from "@/components/layout/app-header";
import { BackNavigation } from "@/components/layout/back-navigation";
import { PwaStatus } from "@/components/pwa/pwa-status";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getMessages } from "@/i18n/server";
import { brandColors } from "@/lib/pwa/brand-colors";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.common.app.name,
    description: t.common.app.description,
    applicationName: t.common.app.name,
    appleWebApp: { capable: true, title: t.pwa.shortName, statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

// "cover" lets the native app draw under the iPhone notch; globals.css pads by the safe areas.
export const viewport: Viewport = { viewportFit: "cover", themeColor: brandColors.primary };

// Pages render their own <main id="main" tabIndex={-1}> — the skip link targets it.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <html lang={locale} className={`${inter.variable} ${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-ink-foreground"
        >
          {t.common.layout.skipToContent}
        </a>
        <I18nProvider locale={locale}>
          <AppSampleBanner />
          <Providers>
            <LiveRegionProvider>
              <AppHeader />
              <BackNavigation />
              <PwaStatus />
              {children}
              <Toaster />
            </LiveRegionProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
