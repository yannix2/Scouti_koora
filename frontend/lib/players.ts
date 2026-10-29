// The backend identifies players by name (no stable IDs), so URLs carry the name with spaces as underscores.
export function playerSlug(name: string): string {
  return encodeURIComponent(name.replaceAll(" ", "_"))
}

export function playerFromSlug(slug: string): string {
  return decodeURIComponent(slug).replaceAll("_", " ")
}

export function playerHref(locale: string, name: string): string {
  return `/${locale}/players/${playerSlug(name)}`
}

export type PositionName = "Goalkeeper" | "Defender" | "Midfielder" | "Forward"
export type PositionCode = "GK" | "DF" | "MF" | "FW"

export const positionCode: Record<PositionName, PositionCode> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Forward: "FW",
}

export const codeToApiPosition: Record<PositionCode, string> = {
  GK: "goalkeeper",
  DF: "defender",
  MF: "midfielder",
  FW: "forward",
}

export function toCode(position: string | null | undefined): PositionCode | null {
  return position && position in positionCode ? positionCode[position as PositionName] : null
}

export const leagues = ["EPL", "LaLiga", "SerieA", "Bundesliga", "Ligue1"] as const

export const leagueName: Record<string, string> = {
  EPL: "Premier League",
  LaLiga: "LaLiga",
  SerieA: "Serie A",
  Bundesliga: "Bundesliga",
  Ligue1: "Ligue 1",
}

/** Deterministic 0..1 from a string, so a player's pitch spot never jumps between renders. */
export function hash01(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10_000) / 10_000
}

// The three numbers shown when a ranked row expands ("why this score"), per position.
export const whyStats: Record<PositionCode, ("goals_p90" | "assists_p90" | "tackles_won_p90" | "availability_pct")[]> = {
  FW: ["goals_p90", "assists_p90", "availability_pct"],
  MF: ["assists_p90", "goals_p90", "tackles_won_p90"],
  DF: ["tackles_won_p90", "availability_pct", "assists_p90"],
  GK: ["availability_pct", "tackles_won_p90", "assists_p90"],
}
