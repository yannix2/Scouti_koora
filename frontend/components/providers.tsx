"use client"

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { MotionConfig } from "motion/react"
import { DirectionProvider } from "@/components/ui/direction"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { I18nProvider } from "@/i18n/client"
import type { Dictionary } from "@/i18n/dictionaries"
import { localeDir, type Locale } from "@/i18n/config"

export function Providers({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } })
  )
  const dir = localeDir[locale]
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <I18nProvider locale={locale} dict={dict}>
            <DirectionProvider dir={dir}>
              <MotionConfig reducedMotion="user">
                <TooltipProvider delayDuration={250}>
                  {children}
                  <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
                </TooltipProvider>
              </MotionConfig>
            </DirectionProvider>
          </I18nProvider>
        </NuqsAdapter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
