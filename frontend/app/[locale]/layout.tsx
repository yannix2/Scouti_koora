import type { Metadata, Viewport } from "next"
import { Alexandria } from "next/font/google"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/shell/app-shell"
import { getDictionary, getLocale } from "@/i18n/dictionaries"
import { localeDir, locales } from "@/i18n/config"
import "../globals.css"

// One family for every level, Latin and Arabic, with true tabular figures.
const alexandria = Alexandria({ subsets: ["latin", "arabic"], variable: "--font-alexandria", display: "swap" })

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  const locale = await getLocale()
  return {
    title: { default: dict.meta.title, template: "%s · ScoutiKoora" },
    description: dict.meta.description,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
    openGraph: { siteName: "ScoutiKoora", locale },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#123d2b" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1d14" },
  ],
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale()
  const dict = await getDictionary()
  return (
    <html lang={locale} dir={localeDir[locale]} className={alexandria.variable} suppressHydrationWarning>
      <body>
        <Providers locale={locale} dict={dict}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
