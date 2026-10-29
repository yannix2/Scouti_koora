"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import { parseAsString, useQueryStates } from "nuqs"
import { ArrowLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Monogram, PositionChip } from "@/components/player/bits"
import { PlayerSearch } from "@/components/player/player-search"
import { PerformanceRadar } from "@/features/report/radar-chart"
import { useTrack } from "@/features/scouting/use-scouting"
import { api, enc } from "@/lib/api/client"
import { compareSchema, radarSchema, type Profile } from "@/lib/api/schemas"
import { formatEuro, formatInt, formatNumber, formatPct } from "@/lib/format"
import { leagueName, playerHref } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { label } from "@/i18n/translate"

const EASE = [0.16, 1, 0.3, 1] as const
type Stat = { key: keyof Profile; kind: "p90" | "pct" | "eur" | "score" | "int"; lowerIsBetter?: boolean }
const STATS: Stat[] = [
  { key: "predicted_talent", kind: "score" },
  { key: "goals_p90", kind: "p90" },
  { key: "assists_p90", kind: "p90" },
  { key: "g_a_p90", kind: "p90" },
  { key: "shots_p90", kind: "p90" },
  { key: "shot_accuracy_pct", kind: "pct" },
  { key: "tackles_won_p90", kind: "p90" },
  { key: "interceptions_p90", kind: "p90" },
  { key: "def_actions_p90", kind: "p90" },
  { key: "availability_pct", kind: "pct" },
  { key: "market_value_eur", kind: "eur", lowerIsBetter: true },
  { key: "Age", kind: "int", lowerIsBetter: true },
]

export function Compare() {
  const { dict, intl, locale } = useI18n()
  const [{ a, b }, set] = useQueryStates({ a: parseAsString, b: parseAsString }, { history: "replace" })
  const track = useTrack()
  const both = !!a && !!b

  const cmp = useQuery({
    queryKey: ["compare", a, b],
    queryFn: () => api("/compare", compareSchema, { query: { player_a: a, player_b: b } }),
    enabled: both,
  })
  const radarA = useQuery({ queryKey: ["radar", a], queryFn: () => api(`/radar/${enc(a!)}`, radarSchema), enabled: both })
  const radarB = useQuery({ queryKey: ["radar", b], queryFn: () => api(`/radar/${enc(b!)}`, radarSchema), enabled: both })

  useEffect(() => {
    if (cmp.data) track(cmp.data.player_a.Player, "compare")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmp.data])

  const statLabel = (k: keyof Profile) =>
    k === "predicted_talent" ? dict.report.talentScore : k === "market_value_eur" ? dict.table.value : k === "Age" ? dict.table.age : label(dict.stats as Record<string, string>, String(k))
  const fmt = (v: number | null | undefined, kind: Stat["kind"]) =>
    kind === "eur" ? formatEuro(v, intl) : kind === "pct" ? formatPct(v, intl) : kind === "int" ? formatInt(v, intl) : kind === "score" ? formatNumber(v, intl, 1) : formatNumber(v, intl)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-end gap-3 rounded-2xl border bg-card p-4 shadow-md md:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{dict.compare.pickA}</p>
          <PlayerSearch key={`a-${a}`} defaultValue={a ?? ""} placeholder={dict.compare.pick} onSelect={(p) => set({ a: p.Player })} />
        </div>
        <Button variant="outline" size="icon-lg" onClick={() => set({ a: b, b: a })} aria-label={dict.compare.swap} disabled={!a && !b} className="mx-auto">
          <ArrowLeftRight />
        </Button>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{dict.compare.pickB}</p>
          <PlayerSearch key={`b-${b}`} defaultValue={b ?? ""} placeholder={dict.compare.pick} onSelect={(p) => set({ b: p.Player })} />
        </div>
      </div>

      {!both ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{dict.compare.empty}</p>
      ) : cmp.isError ? (
        <p className="rounded-2xl border p-8 text-sm text-flag-ink">{dict.actions.error}</p>
      ) : !cmp.data ? (
        <Skeleton className="h-[32rem] w-full rounded-2xl" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-lg">
            <div className="grid grid-cols-[1fr_9rem_1fr] items-center border-b">
              <Head p={cmp.data.player_a} tone="text-chart-2" align="start" locale={locale} />
              <p className="text-center text-[0.7rem] text-muted-foreground">{dict.compare.higher}</p>
              <Head p={cmp.data.player_b} tone="text-chart-4" align="end" locale={locale} />
            </div>
            <ul>
              {STATS.map((s, i) => {
                const va = cmp.data.player_a[s.key] as number | null | undefined
                const vb = cmp.data.player_b[s.key] as number | null | undefined
                const max = Math.max(Math.abs(va ?? 0), Math.abs(vb ?? 0)) || 1
                const better = va == null || vb == null || va === vb ? null : (va > vb) !== !!s.lowerIsBetter ? "a" : "b"
                return (
                  <li key={String(s.key)} className={cn("grid grid-cols-[1fr_9rem_1fr] items-center gap-3 px-4 py-2", i % 2 ? "bg-stripe-b" : "bg-stripe-a")}>
                    <Side value={fmt(va, s.kind)} pct={((va ?? 0) / max) * 100} win={better === "a"} tone="bg-chart-2" side="a" delay={i * 0.04} />
                    <span className="text-center text-xs font-medium text-muted-foreground">{statLabel(s.key)}</span>
                    <Side value={fmt(vb, s.kind)} pct={((vb ?? 0) / max) * 100} win={better === "b"} tone="bg-chart-4" side="b" delay={i * 0.04} />
                  </li>
                )
              })}
            </ul>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-md">
            <h2 className="font-semibold">{dict.report.radar}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{dict.report.radarNote}</p>
            {radarA.data && radarB.data ? (
              <PerformanceRadar axes={radarA.data.axes} compare={radarB.data.axes} names={[cmp.data.player_a.Player, cmp.data.player_b.Player]} />
            ) : (
              <Skeleton className="mt-4 h-72 w-full" />
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-2" />{cmp.data.player_a.Player}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-4" />{cmp.data.player_b.Player}</span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Head({ p, tone, align, locale }: { p: Profile; tone: string; align: "start" | "end"; locale: string }) {
  return (
    <Link
      href={playerHref(locale, p.Player)}
      className={cn("flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-accent", align === "end" && "flex-row-reverse text-end")}
    >
      <Monogram name={p.Player} position={p.Position} />
      <span className="min-w-0">
        <span dir="auto" className={cn("block truncate font-semibold", tone)}>{p.Player}</span>
        <span className={cn("mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground", align === "end" && "justify-end")}>
          <PositionChip position={p.Position} />
          <span className="truncate">{[p.Squad, p.League ? (leagueName[p.League] ?? p.League) : null].filter(Boolean).join(" · ")}</span>
        </span>
      </span>
    </Link>
  )
}

/** One side of the centre rail: the bar grows outward from the rail toward its player. */
function Side({ value, pct, win, tone, side, delay }: { value: string; pct: number; win: boolean; tone: string; side: "a" | "b"; delay: number }) {
  return (
    <div className={cn("flex items-center gap-3", side === "a" && "flex-row-reverse")}>
      <div className={cn("relative h-2 flex-1 overflow-hidden rounded-full bg-muted", side === "a" && "-scale-x-100")}>
        <motion.span
          className={cn("absolute inset-y-0 start-0 rounded-full", tone, !win && "opacity-45")}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 + delay }}
        />
      </div>
      <span className={cn("w-16 shrink-0 text-sm", side === "a" ? "text-start" : "text-end", win ? "font-semibold" : "text-muted-foreground")}>{value}</span>
    </div>
  )
}
