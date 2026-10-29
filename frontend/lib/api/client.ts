"use client"

import type { z } from "zod"

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

// Browser calls go through the Next.js proxy (/api/gw), which adds the session's Bearer token.
export async function api<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal }
): Promise<z.infer<S>> {
  const url = new URL(`/api/gw${path}`, window.location.origin)
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {}
    throw new ApiError(res.status, String(detail))
  }
  if (res.status === 204) return schema.parse(undefined)
  return schema.parse(await res.json())
}

export const enc = encodeURIComponent
