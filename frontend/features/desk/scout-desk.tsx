"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { ArrowUpRight, Flame, Sparkles, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Monogram, PositionChip, TalentMeter } from "@/components/player/bits"
import { PlayerSearch } from "@/components/player/player-search"
import { SaveButton } from "@/components/player/player-actions"
import type { PlayerRow, Trending } from "@/lib/api/schemas"
import { formatEuro, formatInt, formatNumber, formatPct } from "@/lib/format"
import { playerHref, toCode, whyStats, type PositionCode } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { interpolate, label } from "@/i18n/translate"
import { Pitch, type PitchPlayer } from "./pitch"

type Tab = "all" | PositionCode
const EASE = [0.16, 1, 0.3, 1] as const

export function ScoutDesk({ talent, gems, trending }: { talent: Record<Tab, PlayerRow[]>; gems: PlayerRow[]; trending: Trending }) {
  const { dict, locale, dir } = useI18n()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("all")
  const [hovered, setHovered] = useState<string | null>(null)
  const rows = talent[tab]

  const dots: PitchPlayer[] = useMemo(() => {
    const seen = new Set<string>()
    const out: PitchPlayer[] = []
    for (const p of rows) if (!seen.has(p.Player)) (seen.add(p.Player), out.push({ name: p.Player, position: p.Position, score: p.predicted_talent, kind: "talent" }))
    for (const p of gems.slice(0, 8))
      if (!seen.has(p.Player)) (seen.add(p.Player), out.push({ name: p.Player, position: p.Position, score: p.predicted_talent, kind: "gem" }))
    return out
  }, [rows, gems])

  return (
    <LayoutGroup>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(24rem,1fr)]">
        <section className="@container flex min-w-0 flex-col gap-4" aria-label={dict.desk.pitchLabel}>
          <Pitch
            players={dots}
            highlighted={hovered}
            onHover={setHovered}
            onOpen={(name) => router.push(playerHref(locale, name))}
            rtl={dir === "rtl"}
            label={dict.desk.pitchLabel}
          >
            <PlayerSearch size="lg" />
          </Pitch>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="grid size-4 place-items-center rounded bg-pitch-a"><span className="size-1.5 rounded-full bg-chalk-line" /></span> {dict.desk.legendTalent}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="grid size-4 place-items-center rounded bg-pitch-a"><span className="size-1.5 rotate-45 rounded-[1px] bg-chalk-line" /></span> {dict.desk.legendGem}
              </span>
            </div>
            <TrendingStrip trending={trending} onHover={setHovered} />
          </div>
          <GemsStrip gems={gems} onHover={setHovered} />
        </section>

        <section className="flex min-w-0 flex-col self-start overflow-hidden rounded-2xl border bg-card shadow-lg" aria-labelledby="top-talent">
          <div className="flex flex-col gap-3 border-b px-4 pt-4 pb-3">
            <div>
              <h2 id="top-talent" className="text-base font-semibold">
                {dict.desk.topTalent}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{dict.desk.topTalentNote}</p>
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList className="w-full">
                {(["all", "FW", "MF", "DF", "GK"] as Tab[]).map((t) => (
                  <TabsTrigger key={t} value={t} className="flex-1">
                    {label(dict.positions, t)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <TalentTable rows={rows} hovered={hovered} onHover={setHovered} />
        </section>
      </div>
    </LayoutGroup>
  )
}

function TrendingStrip({ trending, onHover }: { trending: Trending; onHover: (n: string | null) => void }) {
  const { dict, locale } = useI18n()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Flame className="size-3.5 shrink-0 text-flag" aria-hidden />
      <span className="shrink-0 font-medium text-foreground">{dict.desk.trending}</span>
      {trending.length === 0 ? (
        <span className="truncate">{dict.desk.trendingEmpty}</span>
      ) : (
        <ul className="flex min-w-0 gap-1.5 overflow-x-auto">
          {trending.slice(0, 5).map((t) => (
            <li key={t.Player}>
              <Link
                href={playerHref(locale, t.Player)}
                onMouseEnter={() => onHover(t.Player)}
                onMouseLeave={() => onHover(null)}
                className="inline-flex h-6 items-center gap-1 rounded-full border bg-card px-2 whitespace-nowrap text-foreground shadow-xs transition-shadow hover:shadow-md"
              >
                {t.Player}
                <span className="text-muted-foreground">{interpolate(t.view_count === 1 ? dict.desk.viewsOne : dict.desk.views, { n: t.view_count })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TalentTable({ rows, hovered, onHover }: { rows: PlayerRow[]; hovered: string | null; onHover: (n: string | null) => void }) {
  const { dict, intl } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  if (rows.length === 0) return <p className="p-6 text-sm text-muted-foreground">{dict.table.empty}</p>

  return (
    <div role="table" aria-label={dict.desk.topTalent} className="flex-1 text-sm">
      <div role="row" className="grid grid-cols-[1.25rem_minmax(0,1fr)_2rem_3.5rem_4.5rem] items-center gap-2 px-4 py-2 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        <span role="columnheader">#</span>
        <span role="columnheader">{dict.table.player}</span>
        <span role="columnheader" className="text-end">{dict.table.age}</span>
        <span role="columnheader" className="text-end">{dict.table.value}</span>
        <span role="columnheader" className="text-end">{dict.table.talent}</span>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {rows.map((p, i) => {
          const isOpen = open === p.Player
          const dim = (hovered && hovered !== p.Player) || (open && !isOpen)
          return (
            <motion.div
              layout
              key={p.Player}
              role="row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: dim ? 0.55 : 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ layout: { type: "spring", stiffness: 380, damping: 36 }, duration: 0.35, ease: EASE, delay: i * 0.025 }}
              className={cn(
                "relative border-t border-border/60",
                i % 2 ? "bg-stripe-b" : "bg-stripe-a",
                isOpen && "z-10 bg-card shadow-lg"
              )}
              onMouseEnter={() => onHover(p.Player)}
              onMouseLeave={() => onHover(null)}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onFocus={() => onHover(p.Player)}
                onBlur={() => onHover(null)}
                onClick={() => setOpen(isOpen ? null : p.Player)}
                className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_2rem_3.5rem_4.5rem] items-center gap-2 px-4 py-2.5 text-start outline-none focus-visible:bg-accent"
              >
                <span role="cell" className="text-xs text-muted-foreground">{i + 1}</span>
                <span role="cell" className="flex min-w-0 items-center gap-2.5">
                  <Monogram name={p.Player} position={p.Position} size="sm" />
                  <span className="min-w-0">
                    <span dir="auto" className="block truncate text-start font-medium">{p.Player}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <PositionChip position={p.Position} className="h-4 px-1 text-[0.6rem]" />
                      <span dir="auto" className="truncate">{p.Squad}</span>
                    </span>
                  </span>
                </span>
                <span role="cell" className="text-end">{formatInt(p.Age, intl)}</span>
                <span role="cell" className="text-end text-muted-foreground">{formatEuro(p.market_value_eur, intl)}</span>
                <span role="cell" className="flex justify-end"><TalentMeter value={p.predicted_talent} compact /></span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="why"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <WhyScore p={p} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function WhyScore({ p }: { p: PlayerRow }) {
  const { dict, intl, locale } = useI18n()
  const code = toCode(p.Position) ?? "MF"
  return (
    <div className="flex flex-col gap-3 px-4 pb-3.5 ps-12">
      <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{dict.desk.whyScore}</p>
      <dl className="grid grid-cols-3 gap-2">
        {whyStats[code].map((k, i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.05, duration: 0.3, ease: EASE }}
            className="rounded-lg border bg-background px-2.5 py-2 shadow-xs"
          >
            <dt className="truncate text-[0.7rem] text-muted-foreground">{dict.stats[k]}</dt>
            <dd className="mt-0.5 text-base font-semibold">
              {k === "availability_pct" ? formatPct(p[k], intl) : formatNumber(p[k], intl)}
            </dd>
          </motion.div>
        ))}
      </dl>
      <div className="flex items-center gap-1.5">
        {p.style_label && <span className="me-auto truncate text-xs text-muted-foreground">{label(dict.styles, p.style_label)}</span>}
        <SaveButton name={p.Player} />
        <Button asChild size="sm">
          <Link href={playerHref(locale, p.Player)}>
            {dict.desk.openReport}
            <ArrowUpRight data-icon="inline-end" className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function GemsStrip({ gems, onHover }: { gems: PlayerRow[]; onHover: (n: string | null) => void }) {
  const { dict, intl, locale } = useI18n()
  return (
    <section className="mt-2" aria-labelledby="gems">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="gems" className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-pos-gk" aria-hidden />
            {dict.desk.hiddenGems}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{dict.desk.hiddenGemsNote}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/discover?tab=gems`}>
            {dict.nav.discover}
            <ArrowUpRight data-icon="inline-end" className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
      <ul className="grid gap-3 @md:grid-cols-2 @4xl:grid-cols-3">
        {gems.slice(0, 6).map((p, i) => (
          <motion.li
            key={p.Player}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + i * 0.05, duration: 0.5, ease: EASE }}
            className="min-w-0"
            onMouseEnter={() => onHover(p.Player)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-[box-shadow,translate] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start gap-2.5">
                <Monogram name={p.Player} position={p.Position} />
                <div className="min-w-0 flex-1">
                  <Link href={playerHref(locale, p.Player)} dir="auto" className="block truncate text-start font-medium hover:underline">
                    {p.Player}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{[p.Squad, p.League].filter(Boolean).join(" · ")}</p>
                </div>
                <SaveButton name={p.Player} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <PositionChip position={p.Position} />
                <span className="text-muted-foreground">
                  {formatInt(p.Age, intl)} · {formatEuro(p.market_value_eur, intl)}
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between border-t pt-2.5">
                <Link
                  href={`/${locale}/discover?tab=similar&ref=${encodeURIComponent(p.Player)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Users className="size-3.5" />
                  {dict.actions.similar}
                </Link>
                <TalentMeter value={p.predicted_talent} />
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
