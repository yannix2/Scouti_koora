import "server-only"
import { cacheLife } from "next/cache"
import type { z } from "zod"
import {
  compareSchema,
  playerRowsSchema,
  profileSchema,
  radarSchema,
  reportSchema,
  stylesSchema,
  trendingSchema,
} from "./schemas"

export const GATEWAY_URL = process.env.API_URL ?? "http://127.0.0.1:8000"

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function get<S extends z.ZodType>(path: string, schema: S, params?: Record<string, string | number | boolean | undefined>): Promise<z.infer<S>> {
  const url = new URL(path, GATEWAY_URL)
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new GatewayError(res.status, `${res.status} ${url.pathname}`)
  return schema.parse(await res.json())
}

async function getOrNull<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S> | null> {
  try {
    return await get(path, schema)
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) return null
    throw e
  }
}

const enc = encodeURIComponent

// Model outputs change only when the notebooks are rerun, so public reads are cached for hours.
export async function getTopTalent(position?: string) {
  "use cache"
  cacheLife("hours")
  return get("/recommend", playerRowsSchema, { position, min_minutes: 1500, top_n: 10 })
}

export async function getHiddenGems() {
  "use cache"
  cacheLife("hours")
  return get("/hidden-gems", playerRowsSchema, { max_value_eur: 15_000_000, max_age: 26, top_n: 10 })
}

export async function getTrending() {
  "use cache"
  cacheLife("minutes")
  return get("/recommendations/trending", trendingSchema, { limit: 8 })
}

export async function getProfile(name: string) {
  "use cache"
  cacheLife("hours")
  return getOrNull(`/players/${enc(name)}`, profileSchema)
}

export async function getReport(name: string) {
  "use cache"
  cacheLife("hours")
  return getOrNull(`/report/${enc(name)}`, reportSchema)
}

export async function getRadar(name: string) {
  "use cache"
  cacheLife("hours")
  return getOrNull(`/radar/${enc(name)}`, radarSchema)
}

export async function getSimilar(name: string) {
  "use cache"
  cacheLife("hours")
  try {
    return await get(`/similar/${enc(name)}`, playerRowsSchema, { top_n: 8, same_position: true })
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) return []
    throw e
  }
}

export async function getComparison(a: string, b: string) {
  "use cache"
  cacheLife("hours")
  return get("/compare", compareSchema, { player_a: a, player_b: b })
}

export async function getStyles() {
  "use cache"
  cacheLife("hours")
  return get("/styles", stylesSchema)
}
