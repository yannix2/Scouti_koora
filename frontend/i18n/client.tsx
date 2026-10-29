"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Dictionary } from "./dictionaries"
import { intlLocale, localeDir, type Locale } from "./config"

type I18nValue = { locale: Locale; dir: "ltr" | "rtl"; intl: string; dict: Dictionary }

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, dir: localeDir[locale], intl: intlLocale[locale], dict }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>")
  return value
}
