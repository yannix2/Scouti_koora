"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { userSchema, type User } from "@/lib/api/schemas"

export const sessionQuery = {
  queryKey: ["me"],
  queryFn: async (): Promise<User | null> => {
    const res = await fetch("/api/auth/me")
    if (!res.ok) throw new Error("session")
    const data = await res.json()
    return data ? userSchema.parse(data) : null
  },
  staleTime: 5 * 60_000,
}

export function useSession() {
  return useQuery(sessionQuery)
}

/** Resolves the session even if the first query is still in flight (e.g. a click right after page load). */
export function useEnsureSession() {
  const qc = useQueryClient()
  return () => qc.ensureQueryData(sessionQuery)
}

type Credentials = { email: string; password: string; name?: string; role?: string }

export function useAuth(action: "login" | "register") {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Credentials) => {
      const res = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw Object.assign(new Error(String(data.detail ?? "error")), { status: res.status })
      return userSchema.parse(data)
    },
    onSuccess: (user) => {
      qc.setQueryData(["me"], user)
      qc.invalidateQueries({ queryKey: ["scouting"] })
    },
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["me"], null)
      qc.removeQueries({ queryKey: ["scouting"] })
    },
  })
}
