"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { ArrowDownUp, ArrowLeftRight, RotateCcw, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Monogram, PositionChip, TalentMeter } from "@/components/player/bits"
import { PlayerSearch } from "@/components/player/player-search"
import { SaveButton } from "@/components/player/player-actions"
import { api, enc } from "@/lib/api/client"
import { playerRowsSchema, stylesSchema, type PlayerRow } from "@/lib/api/schemas"
import { formatEuro, formatInt, formatNumber } from "@/lib/format"
import { codeToApiPosition, leagueName, leagues, playerHref, type PositionCode } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { interpolate, label } from "@/i18n/translate"

const TABS = ["recommend", "gems", "similar"] as const
const POS = ["FW", "MF", "DF", "GK"] as const
// Budget stops in € millions; the last stop means "no limit".
const BUDGET = [1, 2, 5, 10, 15, 20, 30, 50, 75, 100, 150, 0]
const EASE = [0.16, 1, 0.3, 1] as const

const filters = {
  tab: parseAsStringLiteral(TABS).withDefault("recommend"),
  pos: parseAsStringLiteral(POS),
  style: parseAsString,
  budget: parseAsInteger.withDefault(BUDGET.length - 1),
  age: parseAsArrayOf(parseAsInteger).withDefault([16, 40]),
  lg: parseAsArrayOf(parseAsString).withDefault([]),
  min: parseAsInteger.withDefault(900),
  talent: parseAsInteger.withDefault(60),
  ref: parseAsString,
  same: parseAsBoolean.withDefault(true),
}

type SortKey = "talent" | "value" | "age" | "match"

export function Discover() {
  const { dict, intl } = useI18n()
  const [f, setF] = useQueryStates(filters, { history: "replace" })
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "talent", desc: true })
  const [showFilters, setShowFilters] = useState(false)
  const budgetEur = BUDGET[f.budget] ? BUDGET[f.budget] * 1_000_000 : undefined
  const position = f.pos ? codeToApiPosition[f.pos as PositionCode] : undefined

  const styles = useQuery({ queryKey: ["styles"], queryFn: () => api("/styles", stylesSchema), staleTime: Infinity })

  const results = useQuery({
    queryKey: ["discover", f.tab, position, f.style, budgetEur, f.age, f.lg, f.min, f.talent, f.ref, f.same],
    placeholderData: keepPreviousData,
    enabled: f.tab !== "similar" || !!f.ref,
    queryFn: ({ signal }) => {
      if (f.tab === "gems")
        return api("/hidden-gems", playerRowsSchema, {
          signal,
          query: { position, max_value_eur: budgetEur ?? 20_000_000, min_talent_score: f.talent, max_age: f.age[1], top_n: 60 },
        })
      if (f.tab === "similar")
        return api(`/similar/${enc(f.ref ?? "")}`, playerRowsSchema, { signal, query: { top_n: 25, same_position: f.same } })
      return api("/recommend", playerRowsSchema, {
        signal,
        query: {
          position,
          style: f.style,
          max_budget_eur: budgetEur,
          min_age: f.age[0],
          max_age: f.age[1],
          leagues: f.lg.length ? f.lg.join(",") : undefined,
          min_minutes: f.min,
          top_n: 60,
        },
      })
    },
  })

  const rows = useMemo(() => {
    const data = [...(results.data ?? [])]
    const val = (p: PlayerRow) =>
      sort.key === "talent" ? p.predicted_talent : sort.key === "value" ? p.market_value_eur : sort.key === "age" ? p.Age : p.similarity_pct
    if (f.tab === "similar" && sort.key === "talent" && sort.desc) return data
    return data.sort((a, b) => ((val(a) ?? -1) - (val(b) ?? -1)) * (sort.desc ? -1 : 1))
  }, [results.data, sort, f.tab])

  const reset = () => setF({ pos: null, style: null, budget: null, age: null, lg: null, min: null, talent: null })

  const filterPanel = (
    <div className="flex flex-col gap-5">
      <Field label={dict.discover.position}>
        <Select value={f.pos ?? "any"} onValueChange={(v) => setF({ pos: v === "any" ? null : (v as PositionCode) })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{dict.discover.anyPosition}</SelectItem>
            {POS.map((p) => (
              <SelectItem key={p} value={p}>
                {label(dict.positions, { FW: "Forward", MF: "Midfielder", DF: "Defender", GK: "Goalkeeper" }[p])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {f.tab === "recommend" && (
        <Field label={dict.discover.style}>
          <Select value={f.style ?? "any"} onValueChange={(v) => setF({ style: v === "any" ? null : v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{dict.discover.anyStyle}</SelectItem>
              {(styles.data ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  {label(dict.styles, s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label={dict.discover.budget} value={BUDGET[f.budget] ? formatEuro(BUDGET[f.budget] * 1_000_000, intl) : dict.discover.noLimit}>
        <Slider min={0} max={BUDGET.length - 1} step={1} value={[f.budget]} onValueChange={([v]) => setF({ budget: v })} aria-label={dict.discover.budget} />
      </Field>

      <Field label={dict.discover.age} value={f.tab === "gems" ? `≤ ${f.age[1]}` : `${f.age[0]}–${f.age[1]}`}>
        <Slider
          min={16}
          max={40}
          step={1}
          value={f.tab === "gems" ? [f.age[1]] : f.age}
          onValueChange={(v) => setF({ age: v.length === 1 ? [16, v[0]] : v })}
          aria-label={dict.discover.age}
        />
      </Field>

      {f.tab === "gems" ? (
        <Field label={dict.discover.minTalent} value={String(f.talent)}>
          <Slider min={40} max={90} step={1} value={[f.talent]} onValueChange={([v]) => setF({ talent: v })} aria-label={dict.discover.minTalent} />
        </Field>
      ) : (
        <>
          <Field label={dict.discover.minMinutes} value={formatInt(f.min, intl)}>
            <Slider min={0} max={3000} step={100} value={[f.min]} onValueChange={([v]) => setF({ min: v })} aria-label={dict.discover.minMinutes} />
          </Field>
          <Field label={dict.discover.leagues}>
            <ToggleGroup type="multiple" variant="outline" value={f.lg} onValueChange={(v) => setF({ lg: v })} className="flex w-full flex-wrap justify-start">
              {leagues.map((l) => (
                <ToggleGroupItem key={l} value={l} className="h-8 px-2.5 text-xs">
                  {leagueName[l]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </>
      )}

      <Button variant="ghost" onClick={reset} className="self-start">
        <RotateCcw data-icon="inline-start" />
        {dict.discover.reset}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={f.tab} onValueChange={(v) => setF({ tab: v as (typeof TABS)[number] })}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="px-4">
              {dict.discover.tabs[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {f.tab === "similar" && (
        <div className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-4 shadow-md">
          <div className="min-w-64 flex-1">
            <Label className="mb-2 block text-xs text-muted-foreground">{dict.discover.reference}</Label>
            <PlayerSearch
              key={f.ref ?? "none"}
              defaultValue={f.ref ?? ""}
              placeholder={dict.discover.referencePlaceholder}
              onSelect={(p) => setF({ ref: p.Player })}
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm">
            <Switch checked={f.same} onCheckedChange={(v) => setF({ same: v })} />
            {dict.discover.samePosition}
          </label>
        </div>
      )}

      <div className={cn("grid gap-6", f.tab !== "similar" && "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
        {f.tab !== "similar" && (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Button variant="outline" className="mb-3 w-full lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              {showFilters ? <X data-icon="inline-start" /> : <SlidersHorizontal data-icon="inline-start" />}
              {dict.discover.position} · {dict.discover.budget} · {dict.discover.age}
            </Button>
            <div className={cn("rounded-2xl border bg-card p-5 shadow-md", !showFilters && "hidden lg:block")}>{filterPanel}</div>
          </aside>
        )}

        <section className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-lg" aria-live="polite" aria-busy={results.isFetching}>
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm">
            <span className="font-medium">{results.data ? interpolate(rows.length === 1 ? dict.discover.resultsOne : dict.discover.results, { n: rows.length }) : " "}</span>
            {results.isFetching && <span className="text-xs text-muted-foreground">{dict.desk.searching}</span>}
          </div>
          {f.tab === "similar" && !f.ref ? (
            <p className="p-8 text-sm text-muted-foreground">{dict.discover.similarEmpty}</p>
          ) : results.isError ? (
            <p className="p-8 text-sm text-flag-ink">{dict.desk.backendDown}</p>
          ) : !results.data ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">{dict.table.empty}</p>
          ) : (
            <ResultsTable rows={rows} sort={sort} setSort={setSort} showMatch={f.tab === "similar"} />
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        {value && <span className="text-muted-foreground">{value}</span>}
      </div>
      {children}
    </div>
  )
}

function ResultsTable({
  rows,
  sort,
  setSort,
  showMatch,
}: {
  rows: PlayerRow[]
  sort: { key: SortKey; desc: boolean }
  setSort: (s: { key: SortKey; desc: boolean }) => void
  showMatch: boolean
}) {
  const { dict, intl, locale } = useI18n()
  const Head = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" className={cn("px-3 py-2.5 font-medium", className)} aria-sort={sort.key === k ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => setSort({ key: k, desc: sort.key === k ? !sort.desc : true })}
        className={cn("inline-flex items-center gap-1 tracking-wide uppercase hover:text-foreground", sort.key === k && "text-foreground")}
      >
        {children}
        <ArrowDownUp className="size-3" />
      </button>
    </th>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm md:min-w-[44rem]">
        <thead className="text-start text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">{dict.table.player}</th>
            <th scope="col" className="px-3 py-2.5 text-start font-medium">{dict.table.pos}</th>
            <Head k="age" className="hidden text-end md:table-cell">{dict.table.age}</Head>
            <th scope="col" className="hidden px-3 py-2.5 text-start font-medium lg:table-cell">{dict.table.style}</th>
            <Head k="value" className="hidden text-end sm:table-cell">{dict.table.value}</Head>
            {showMatch ? <Head k="match" className="text-end">{dict.table.similarity}</Head> : <Head k="talent" className="text-end">{dict.table.talent}</Head>}
            <th scope="col" className="px-4 py-2.5"><span className="sr-only">{dict.table.actions}</span></th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((p, i) => (
              <motion.tr
                layout
                key={p.Player}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 12) * 0.02, layout: { type: "spring", stiffness: 380, damping: 38 } }}
                className={cn("group border-t border-border/60 transition-colors hover:bg-accent/60", i % 2 ? "bg-stripe-b" : "bg-stripe-a")}
              >
                <td className="w-full max-w-0 py-2.5 ps-3 pe-2 md:px-4">
                  <Link href={playerHref(locale, p.Player)} className="flex min-w-0 items-center gap-3">
                    <Monogram name={p.Player} position={p.Position} size="sm" />
                    <span className="min-w-0">
                      <span dir="auto" className="block truncate text-start font-medium group-hover:underline">{p.Player}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[p.Squad, p.League ? (leagueName[p.League] ?? p.League) : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2.5"><PositionChip position={p.Position} /></td>
                <td className="hidden px-3 py-2.5 text-end md:table-cell">{formatInt(p.Age, intl)}</td>
                <td className="hidden max-w-40 truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{p.style_label ? label(dict.styles, p.style_label) : "—"}</td>
                <td className="hidden px-3 py-2.5 text-end sm:table-cell">{formatEuro(p.market_value_eur, intl)}</td>
                <td className="px-3 py-2.5 text-end">
                  {showMatch ? <span className="font-semibold">{formatNumber(p.similarity_pct, intl, 1)}%</span> : <TalentMeter value={p.predicted_talent} compact />}
                </td>
                <td className="px-2 py-2.5 md:px-4">
                  <div className="flex justify-end gap-0.5">
                    <SaveButton name={p.Player} />
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`${dict.actions.compare}: ${p.Player}`}>
                      <Link href={`/${locale}/compare?a=${encodeURIComponent(p.Player)}`}>
                        <ArrowLeftRight />
                      </Link>
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}
