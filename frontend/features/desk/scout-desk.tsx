"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { ArrowUpRight, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Monogram, PositionChip, TalentMeter } from "@/components/player/bits"
import { PitchMark } from "@/components/player/marks"
import { PlayerSearch } from "@/components/player/player-search"
import { SaveButton } from "@/components/player/player-actions"
import type { PlayerRow } from "@/lib/api/schemas"
import { formatEuro, formatInt, formatNumber, formatPct } from "@/lib/format"
import { playerHref, toCode, whyStats, type PositionCode } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { interpolate, label } from "@/i18n/translate"
import { Pitch, type PitchPlayer } from "./pitch"

type Tab = "all" | PositionCode
export type TrendingPlayer = { Player: string; view_count: number; Position?: string | null }
const EASE = [0.16, 1, 0.3, 1] as const

export function ScoutDesk({ talent, gems, trending }: { talent: Record<Tab, PlayerRow[]>; gems: PlayerRow[]; trending: TrendingPlayer[] }) {
  const { dict, locale, dir } = useI18n()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("all")
  const [hovered, setHovered] = useState<string | null>(null)
  const rows = talent[tab]

  // One mark per player: ranked talent first, then hidden gems, then trending players we could place.
  const dots: PitchPlayer[] = useMemo(() => {
    const seen = new Set<string>()
    const out: PitchPlayer[] = []
    const add = (p: PitchPlayer) => !seen.has(p.name) && (seen.add(p.name), out.push(p))
    rows.forEach((p) => add({ name: p.Player, position: p.Position, score: p.predicted_talent, kind: "talent" }))
    gems.slice(0, 6).forEach((p) => add({ name: p.Player, position: p.Position, score: p.predicted_talent, kind: "gem" }))
    trending.filter((t) => t.Position).forEach((t) => add({ name: t.Player, position: t.Position, kind: "trending" }))
    return out
  }, [rows, gems, trending])

  return (
    <LayoutGroup>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(24rem,1fr)]">
        <section className="flex min-w-0 flex-col gap-4" aria-label={dict.desk.pitchLabel}>
          <Pitch
            players={dots}
            highlighted={hovered}
            onHover={setHovered}
            onOpen={(name) => router.push(playerHref(locale, name))}
            rtl={dir === "rtl"}
            label={dict.desk.pitchLabel}
          >
            <PlayerSearch size="lg" placeholder={dict.desk.searchPlaceholderShort} />
          </Pitch>
          <div className="flex flex-col gap-2.5 px-1 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5">
                <PitchMark kind="talent" /> {dict.desk.legendTalent}
              </span>
              <span className="flex items-center gap-1.5">
                <PitchMark kind="gem" /> {dict.desk.legendGem}
              </span>
              <span className="flex items-center gap-1.5">
                <PitchMark kind="trending" /> {dict.desk.legendTrending}
              </span>
            </div>
            <TrendingStrip trending={trending} onHover={setHovered} />
          </div>
          <GemsList gems={gems} hovered={hovered} onHover={setHovered} />
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

function TrendingStrip({ trending, onHover }: { trending: TrendingPlayer[]; onHover: (n: string | null) => void }) {
  const { dict, locale } = useI18n()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 font-medium text-foreground">{dict.desk.trending}</span>
      {trending.length === 0 ? (
        <span className="truncate">{dict.desk.trendingEmpty}</span>
      ) : (
        // Scrolls sideways; the fading edge says there is more.
        <ul className="flex min-w-0 gap-1.5 overflow-x-auto pe-6 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] rtl:[mask-image:linear-gradient(to_left,black_85%,transparent)]">
          {trending.slice(0, 8).map((t) => (
            <li key={t.Player} className="shrink-0">
              <Link
                href={playerHref(locale, t.Player)}
                onMouseEnter={() => onHover(t.Player)}
                onMouseLeave={() => onHover(null)}
                className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2 whitespace-nowrap text-foreground shadow-xs transition-shadow hover:shadow-md"
              >
                <span dir="auto">{t.Player}</span>
                <span className="text-muted-foreground">{interpolate(t.view_count === 1 ? dict.desk.viewsOne : dict.desk.views, { n: t.view_count })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Age drops out below `sm` so names keep their room on phones.
const ROW_GRID = "grid-cols-[1.25rem_minmax(0,1fr)_3.75rem_2.75rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_2rem_3.75rem_2.75rem]"

function TalentTable({ rows, hovered, onHover }: { rows: PlayerRow[]; hovered: string | null; onHover: (n: string | null) => void }) {
  const { dict, intl } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  if (rows.length === 0) return <p className="p-6 text-sm text-muted-foreground">{dict.table.empty}</p>

  return (
    <div role="table" aria-label={dict.desk.topTalent} className="flex-1 text-sm">
      <div role="row" className={cn("grid items-center gap-2 px-4 py-2 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase", ROW_GRID)}>
        <span role="columnheader">#</span>
        <span role="columnheader">{dict.table.player}</span>
        <span role="columnheader" className="hidden text-end sm:block">{dict.table.age}</span>
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
              className={cn("relative border-t border-border/60", i % 2 ? "bg-stripe-b" : "bg-stripe-a", isOpen && "z-10 bg-card shadow-lg")}
              onMouseEnter={() => onHover(p.Player)}
              onMouseLeave={() => onHover(null)}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onFocus={() => onHover(p.Player)}
                onBlur={() => onHover(null)}
                onClick={() => setOpen(isOpen ? null : p.Player)}
                className={cn("grid w-full items-center gap-2 px-4 py-2.5 text-start outline-none focus-visible:bg-accent", ROW_GRID)}
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
                <span role="cell" className="hidden text-end sm:block">{formatInt(p.Age, intl)}</span>
                <span role="cell" className="text-end text-muted-foreground">{formatEuro(p.market_value_eur, intl)}</span>
                <span role="cell" className="flex justify-end"><TalentMeter value={p.predicted_talent} /></span>
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
            <dd className="mt-0.5 text-base font-semibold">{k === "availability_pct" ? formatPct(p[k], intl) : formatNumber(p[k], intl)}</dd>
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

/** Banded list tied to the diamonds on the pitch: hovering a row lights its diamond, and vice versa. */
function GemsList({ gems, hovered, onHover }: { gems: PlayerRow[]; hovered: string | null; onHover: (n: string | null) => void }) {
  const { dict, intl, locale } = useI18n()
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-md" aria-labelledby="gems">
      <div className="flex items-end justify-between gap-4 border-b px-4 py-3">
        <div>
          <h2 id="gems" className="flex items-center gap-2 text-base font-semibold">
            <PitchMark kind="gem" />
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
      <ul>
        {gems.slice(0, 6).map((p, i) => (
          <motion.li
            key={p.Player}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: hovered && hovered !== p.Player ? 0.6 : 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.04, duration: 0.4, ease: EASE }}
            onMouseEnter={() => onHover(p.Player)}
            onMouseLeave={() => onHover(null)}
            className={cn("flex items-center gap-3 border-t border-border/60 px-4 py-2.5 text-sm first:border-t-0", i % 2 ? "bg-stripe-b" : "bg-stripe-a")}
          >
            <Monogram name={p.Player} position={p.Position} size="sm" />
            <span className="min-w-0 flex-1">
              <Link href={playerHref(locale, p.Player)} dir="auto" className="block w-fit max-w-full truncate font-medium hover:underline" onFocus={() => onHover(p.Player)} onBlur={() => onHover(null)}>
                {p.Player}
              </Link>
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <PositionChip position={p.Position} className="h-4 px-1 text-[0.6rem]" />
                <span dir="auto" className="truncate">{p.Squad}</span>
              </span>
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatInt(p.Age, intl)} · {formatEuro(p.market_value_eur, intl)}
            </span>
            <TalentMeter value={p.predicted_talent} />
            <span className="flex items-center">
              <SaveButton name={p.Player} />
              <Button asChild variant="ghost" size="icon-sm" aria-label={`${dict.actions.similar}: ${p.Player}`}>
                <Link href={`/${locale}/discover?tab=similar&ref=${encodeURIComponent(p.Player)}`}>
                  <Users />
                </Link>
              </Button>
            </span>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
