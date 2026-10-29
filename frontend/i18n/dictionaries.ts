import { locale as rootLocale } from "next/root-params"
import { notFound } from "next/navigation"
import { isLocale, type Locale } from "./config"
import type en from "./dictionaries/en.json"

export type Dictionary = typeof en

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
}

export async function getLocale(): Promise<Locale> {
  const value = await rootLocale()
  if (!value || !isLocale(value)) notFound()
  return value
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]()
}
