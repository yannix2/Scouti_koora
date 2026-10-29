import type { NextRequest } from "next/server"
import { GATEWAY_URL } from "@/lib/api/server"
import { clearTokens, readTokens, refreshTokens, setTokens } from "@/lib/session"

async function forward(path: string, body: unknown) {
  return fetch(new URL(path, GATEWAY_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function me(access: string) {
  return fetch(new URL("/auth/me", GATEWAY_URL), { headers: { authorization: `Bearer ${access}` } })
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/auth/[action]">) {
  const { action } = await ctx.params

  if (action === "logout") {
    await clearTokens()
    return new Response(null, { status: 204 })
  }

  if (action === "login" || action === "register") {
    const res = await forward(`/auth/${action}`, await req.json())
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return Response.json({ detail: data.detail ?? "Request failed" }, { status: res.status })
    await setTokens(data)
    const user = await me(data.access_token)
    return Response.json(await user.json(), { status: 200 })
  }

  return Response.json({ detail: "Not found" }, { status: 404 })
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/auth/[action]">) {
  const { action } = await ctx.params
  if (action !== "me") return Response.json({ detail: "Not found" }, { status: 404 })

  let { access } = await readTokens()
  const { refresh } = await readTokens()
  if (!access && refresh) access = (await refreshTokens(refresh)) ?? undefined
  // Signed-out is a normal state, not an error: answer 200 with null so the browser logs nothing.
  if (!access) return Response.json(null)

  let res = await me(access)
  if (res.status === 401 && refresh) {
    const next = await refreshTokens(refresh)
    if (next) res = await me(next)
  }
  if (!res.ok) return Response.json(null)
  return Response.json(await res.json())
}
