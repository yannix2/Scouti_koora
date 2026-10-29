export const locales = ["en", "fr", "ar"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export const localeDir: Record<Locale, "ltr" | "rtl"> = { en: "ltr", fr: "ltr", ar: "rtl" }
export const localeLabel: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" }
// Intl locale tags. Arabic keeps Western digits (0-9) so stats read the same in every language.
export const intlLocale: Record<Locale, string> = { en: "en-US", fr: "fr-FR", ar: "ar-u-nu-latn" }

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value)
