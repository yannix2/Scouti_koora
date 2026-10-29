import { NextResponse, type NextRequest } from "next/server"
import { defaultLocale, isLocale, locales, type Locale } from "./i18n/config"

function preferredLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get("sk_locale")?.value
  if (cookie && isLocale(cookie)) return cookie
  const header = req.headers.get("accept-language") ?? ""
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase()
    if (isLocale(tag)) return tag
  }
  return defaultLocale
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const first = pathname.split("/")[1]

  if (!(locales as readonly string[]).includes(first)) {
    const url = req.nextUrl.clone()
    url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`
    return NextResponse.redirect(url)
  }

  // My scouting needs a session; send visitors to sign in and back.
  if (pathname.startsWith(`/${first}/scouting`) && !req.cookies.get("sk_rt")) {
    const url = req.nextUrl.clone()
    url.pathname = `/${first}/login`
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
}
