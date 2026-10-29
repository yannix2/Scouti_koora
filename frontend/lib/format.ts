const DASH = "—"

export function formatEuro(value: number | null | undefined, intl: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH
  // Arabic compact currency ("3.5 مليون €") is too wide for stat columns; transfer fees read as €3.5M everywhere.
  return new Intl.NumberFormat(intl.startsWith("ar") ? "en-US" : intl, {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: value >= 10_000_000 ? 0 : 1,
  }).format(value)
}

export function formatNumber(value: number | null | undefined, intl: string, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH
  return new Intl.NumberFormat(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function formatInt(value: number | null | undefined, intl: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH
  return new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(value)
}

export function formatPct(value: number | null | undefined, intl: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH
  return new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 0 }).format(value / 100)
}

export function formatDate(value: string, intl: string): string {
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  )
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "")
  return (first + last).toUpperCase()
}
