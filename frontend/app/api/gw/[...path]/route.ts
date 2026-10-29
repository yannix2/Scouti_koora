import type { NextRequest } from "next/server"
import { GATEWAY_URL } from "@/lib/api/server"
import { readTokens, refreshTokens } from "@/lib/session"

// Only data routes are proxied; auth goes through /api/auth so tokens never reach the browser.
const ALLOWED = ["players", "similar", "recommend", "hidden-gems", "compare", "styles", "radar", "report", "scouting", "recommendations", "health"]

async function handle(req: NextRequest, ctx: RouteContext<"/api/gw/[...path]">) {
  const { path } = await ctx.params
  if (!ALLOWED.includes(path[0])) return Response.json({ detail: "Not found" }, { status: 404 })

  const target = new URL(`/${path.map(encodeURIComponent).join("/")}`, GATEWAY_URL)
  target.search = req.nextUrl.search
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text()

  const send = (access?: string) =>
    fetch(target, {
      method: req.method,
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
        ...(access ? { authorization: `Bearer ${access}` } : {}),
      },
      body,
    })

  let { access } = await readTokens()
  const { refresh } = await readTokens()
  if (!access && refresh) access = (await refreshTokens(refresh)) ?? undefined

  let res: Response
  try {
    res = await send(access)
    if (res.status === 401 && refresh) {
      const next = await refreshTokens(refresh)
      if (next) res = await send(next)
    }
  } catch {
    return Response.json({ detail: "Gateway unreachable" }, { status: 503 })
  }

  return new Response(res.status === 204 ? null : await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  })
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE }
