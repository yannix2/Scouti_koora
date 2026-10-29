"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { motion } from "motion/react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAuth } from "./use-session"
import { useI18n } from "@/i18n/client"

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { dict, locale } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const auth = useAuth(mode)
  const [role, setRole] = useState("scout")
  const [error, setError] = useState<string | null>(null)
  const next = params.get("next")
  const safeNext = next && next.startsWith(`/${locale}/`) ? next : `/${locale}/scouting`
  const other = mode === "login" ? "register" : "login"

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    auth.mutate(
      {
        email: String(form.get("email")),
        password: String(form.get("password")),
        ...(mode === "register" ? { name: String(form.get("name")), role } : {}),
      },
      {
        onSuccess: () => router.push(safeNext),
        onError: (err) => {
          const status = (err as Error & { status?: number }).status
          setError(mode === "login" ? dict.auth.invalid : status === 400 || status === 409 ? dict.auth.exists : dict.actions.error)
        },
      }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl md:p-8"
    >
      <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? dict.auth.signInTitle : dict.auth.registerTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? dict.auth.signInSubtitle : dict.auth.registerSubtitle}</p>
      {next && mode === "login" && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{dict.auth.required}</p>}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {mode === "register" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{dict.auth.name}</Label>
            <Input id="name" name="name" required autoComplete="name" className="h-10" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{dict.auth.email}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="h-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{dict.auth.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            dir="ltr"
            className="h-10"
            aria-describedby={mode === "register" ? "pw-hint" : undefined}
          />
          {mode === "register" && (
            <p id="pw-hint" className="text-xs text-muted-foreground">
              {dict.auth.passwordHint}
            </p>
          )}
        </div>
        {mode === "register" && (
          <div className="flex flex-col gap-2">
            <Label>{dict.auth.role}</Label>
            <ToggleGroup type="single" variant="outline" value={role} onValueChange={(v) => v && setRole(v)} className="w-full">
              {(["scout", "agent", "club"] as const).map((r) => (
                <ToggleGroupItem key={r} value={r} className="h-10 flex-1">
                  {dict.auth.roles[r]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-flag-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 text-base" disabled={auth.isPending}>
          {auth.isPending && <Loader2 className="animate-spin" data-icon="inline-start" />}
          {mode === "login" ? dict.auth.signIn : dict.auth.register}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? dict.auth.noAccount : dict.auth.haveAccount}{" "}
        <Link href={`/${locale}/${other}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground underline">
          {mode === "login" ? dict.auth.register : dict.auth.signIn}
        </Link>
      </p>
    </motion.div>
  )
}
