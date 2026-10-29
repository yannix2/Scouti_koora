import "server-only"
import { cookies } from "next/headers"
import { GATEWAY_URL } from "./api/server"

// JWTs live only in httpOnly cookies; client JS never sees them.
const ACCESS = "sk_at"
const REFRESH = "sk_rt"
const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" }

type Tokens = { access_token: string; refresh_token: string }

export async function setTokens(tokens: Tokens) {
  const jar = await cookies()
  jar.set(ACCESS, tokens.access_token, { ...base, maxAge: 60 * 60 })
  jar.set(REFRESH, tokens.refresh_token, { ...base, maxAge: 60 * 60 * 24 * 7 })
}

export async function clearTokens() {
  const jar = await cookies()
  jar.delete(ACCESS)
  jar.delete(REFRESH)
}

export async function readTokens() {
  const jar = await cookies()
  return { access: jar.get(ACCESS)?.value, refresh: jar.get(REFRESH)?.value }
}

/** Exchanges the refresh cookie for new tokens. Returns the new access token, or null (and clears cookies) when expired. */
export async function refreshTokens(refresh: string): Promise<string | null> {
  const res = await fetch(new URL("/auth/refresh", GATEWAY_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  })
  if (!res.ok) {
    await clearTokens()
    return null
  }
  const tokens = (await res.json()) as Tokens
  await setTokens(tokens)
  return tokens.access_token
}

export const REFRESH_COOKIE = REFRESH
