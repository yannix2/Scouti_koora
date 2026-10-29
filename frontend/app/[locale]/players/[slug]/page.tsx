import Link from "next/link"
import { Suspense } from "react"
import type { Metadata } from "next"
import { ArrowLeft, Bandage, TrendingDown, TrendingUp, Minus, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageFrame, BlockSkeleton, ErrorPanel } from "@/components/shell/page"
import { Reveal, PaintBar } from "@/components/motion/reveal"
import { Monogram, PositionChip } from "@/components/player/bits"
import { PerformanceRadar } from "@/features/report/radar-chart"
import { ReportActions, TrackView } from "@/features/report/report-client"
import { AxisName } from "@/features/report/axis-name"
import { getProfile, getRadar, getReport, getSimilar } from "@/lib/api/server"
import type { PlayerRow, Profile, Radar, Report } from "@/lib/api/schemas"
import { formatEuro, formatInt, formatNumber, formatPct } from "@/lib/format"
import { leagueName, playerFromSlug, playerHref } from "@/lib/players"
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries"
import { intlLocale } from "@/i18n/config"
import { interpolate, label } from "@/i18n/translate"

export async function generateMetadata({ params }: PageProps<"/[locale]/players/[slug]">): Promise<Metadata> {
  const name = playerFromSlug((await params).slug)
  return { title: name, alternates: { languages: { en: `/en/players/${(await params).slug}`, fr: `/fr/players/${(await params).slug}`, ar: `/ar/players/${(await params).slug}` } } }
}

export default function PlayerPage({ params }: PageProps<"/[locale]/players/[slug]">) {
  return (
    <PageFrame>
      <Suspense fallback={<ReportSkeleton />}>
        <ReportData params={params} />
      </Suspense>
    </PageFrame>
  )
}

type VerdictKey = keyof Dictionary["verdicts"]
const verdictTone: Record<VerdictKey, string> = {
  "ELITE PROSPECT": "bg-turf text-primary-foreground dark:text-turf-deep",
  "STRONG RECOMMENDATION": "bg-pos-mf text-white dark:text-turf-deep",
  "VALUE BUY": "bg-pos-gk text-white dark:text-turf-deep",
  "VETERAN OPTION": "bg-pos-df text-white dark:text-turf-deep",
  CAUTION: "bg-flag text-white dark:text-turf-deep",
  "MODERATE PROSPECT": "bg-secondary text-secondary-foreground",
  "LIMITED DATA": "bg-muted text-muted-foreground",
}

async function ReportData({ params }: { params: PageProps<"/[locale]/players/[slug]">["params"] }) {
  const name = playerFromSlug((await params).slug)
  const dict = await getDictionary()
  const locale = await getLocale()
  const intl = intlLocale[locale]
  let report: Report | null, profile: Profile | null, radar: Radar | null, similar: PlayerRow[]
  try {
    ;[report, profile, radar, similar] = await Promise.all([getReport(name), getProfile(name), getRadar(name), getSimilar(name)])
  } catch {
    return <ErrorPanel message={dict.desk.backendDown} />
  }
  if (!report || !profile || !radar)
    return (
      <ErrorPanel message={interpolate(dict.report.notFound, { name })}>
        <Link href={`/${locale}`} className="text-sm font-medium underline">
          {dict.common.home}
        </Link>
      </ErrorPanel>
    )

  const player = profile.Player
  const verdictKey = (report.overall_verdict.split(" —")[0] as VerdictKey) ?? "MODERATE PROSPECT"
  const talent = report.stats.talent_score ?? null
  const posName = label(dict.positions, report.position)
  const cats = report.profile.categories_used.map((c) => label(dict.report.cats, c)).join(", ")
  const trend = report.value_assessment.trend
  const TrendIcon = trend === "rising" ? TrendingUp : trend === "declining" ? TrendingDown : Minus

  return (
    <div className="flex flex-col gap-6">
      <TrackView name={player} />
      <Reveal>
        <Link href={`/${locale}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
          {dict.report.back}
        </Link>
      </Reveal>

      {/* Identity + verdict */}
      <Reveal order={1}>
        <section className="overflow-hidden rounded-2xl border bg-card shadow-lg">
          <div className="flex flex-wrap items-start gap-5 p-5 md:p-6">
            <Monogram name={player} position={report.position} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{player}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {[profile.Squad, profile.League ? leagueName[profile.League] ?? profile.League : null, profile.season ? interpolate(dict.report.season, { season: profile.season }) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <PositionChip position={report.position} />
                {report.style_label && report.style_label !== "unknown" && (
                  <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">{label(dict.styles, report.style_label)}</span>
                )}
                {(
                  [
                    [dict.report.info.age, formatInt(report.info.age, intl)],
                    [dict.report.info.nation, report.info.nation ? report.info.nation.split(" ").pop() : null],
                    [dict.report.info.foot, report.info.foot ? label(dict.report.feet, report.info.foot) : null],
                    [dict.report.info.height, report.info.height ? `${formatInt(report.info.height, intl)} cm` : null],
                    [dict.report.info.minutes, formatInt(report.minutes_played, intl)],
                  ] as const
                ).map(([k, v]) =>
                  v ? (
                    <span key={k} className="rounded-md border px-2 py-0.5 text-muted-foreground">
                      {k} <span className="font-medium text-foreground">{v}</span>
                    </span>
                  ) : null
                )}
              </div>
            </div>
            <ReportActions name={player} />
          </div>

          <div className="grid border-t md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="flex flex-col gap-2 p-5 md:p-6">
              <p className="text-xs font-medium text-muted-foreground">{dict.report.verdict}</p>
              <p>
                <span className={cn("inline-flex rounded-lg px-2.5 py-1 text-sm font-semibold shadow-sm", verdictTone[verdictKey])}>
                  {dict.verdicts[verdictKey] ?? verdictKey}
                </span>
              </p>
              <p className="max-w-prose text-sm text-muted-foreground">{dict.verdictText[verdictKey]}</p>
            </div>
            <div className="flex flex-col gap-2 border-t p-5 md:border-t-0 md:border-s md:p-6">
              <p className="text-xs font-medium text-muted-foreground">{dict.report.talentScore}</p>
              <p className="text-4xl font-semibold tracking-tight">{talent == null ? "—" : talent.toFixed(1)}</p>
              <PaintBar value={talent ?? 0} />
              <p className="text-xs text-muted-foreground">{dict.report.talentNote}</p>
            </div>
            <div className="flex flex-col gap-2 border-t p-5 md:border-t-0 md:border-s md:p-6">
              <p className="text-xs font-medium text-muted-foreground">{dict.report.profile}</p>
              <p className="text-2xl font-semibold tracking-tight">{dict.report.bands[report.profile.band]}</p>
              <p className="text-xs text-muted-foreground">{interpolate(dict.report.profileNote, { pos: posName.toLowerCase(), cats: cats.toLowerCase() })}</p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Radar + categories */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Reveal order={2}>
          <section className="h-full rounded-2xl border bg-card p-5 shadow-md md:p-6">
            <h2 className="font-semibold">{dict.report.radar}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{dict.report.radarNote}</p>
            <PerformanceRadar axes={radar.axes} />
          </section>
        </Reveal>
        <Reveal order={3}>
          <section className="flex h-full flex-col gap-5 rounded-2xl border bg-card p-5 shadow-md md:p-6">
            <div>
              <h2 className="font-semibold">{dict.report.categories}</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {Object.entries(report.categories).map(([id, c], i) => (
                  <li key={id} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className={cn(report.profile.categories_used.includes(id) ? "font-medium" : "text-muted-foreground")}>
                      {label(dict.report.cats, id)}
                    </span>
                    <PaintBar value={c.score} delay={i * 0.06} tone={report.profile.categories_used.includes(id) ? "bg-turf" : "bg-muted-foreground/40"} />
                    <span className="text-end font-semibold">{c.score.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AxisList title={dict.report.strengths} items={report.strengths} tone="text-pos-mf" />
              <AxisList title={dict.report.weaknesses} items={report.weaknesses} tone="text-flag-ink" empty={dict.report.noWeaknesses} />
            </div>
          </section>
        </Reveal>
      </div>

      {/* Value, injury, key stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal order={4}>
          <section className="h-full rounded-2xl border bg-card p-5 shadow-md md:p-6">
            <h2 className="font-semibold">{dict.report.value}</h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{formatEuro(report.value_assessment.market_value_eur, intl)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendIcon className={cn("size-4", trend === "rising" && "text-pos-mf", trend === "declining" && "text-flag")} />
              {dict.report.trend[trend]} · {interpolate(dict.report.ofPeak, { pct: report.value_assessment.pct_of_peak.toFixed(0) })}
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{dict.report.peak}</dt>
                <dd className="font-medium">{formatEuro(report.value_assessment.peak_value_eur, intl)}</dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{dict.report.valueScore}</dt>
                  <dd className="font-medium">{report.value_assessment.value_score.toFixed(0)}</dd>
                </div>
                <PaintBar value={report.value_assessment.value_score} tone="bg-pos-gk" />
              </div>
            </dl>
          </section>
        </Reveal>
        <Reveal order={5}>
          <section className="h-full rounded-2xl border bg-card p-5 shadow-md md:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Bandage className="size-4 text-muted-foreground" aria-hidden />
              {dict.report.injury}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{dict.report.injuries}</dt>
                <dd className="text-2xl font-semibold">{formatInt(report.injury_risk.total_injuries, intl)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{dict.report.daysOut}</dt>
                <dd className="text-2xl font-semibold">{report.injury_risk.total_days_out == null ? "—" : formatInt(report.injury_risk.total_days_out, intl)}</dd>
              </div>
            </dl>
            {report.injury_risk.score == null ? (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{dict.report.riskUnknown}</p>
            ) : (
              <div className="mt-4 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{dict.report.risk}</span>
                  <span className="font-medium">{report.injury_risk.score.toFixed(0)}</span>
                </div>
                <PaintBar value={report.injury_risk.score} tone="bg-flag" />
              </div>
            )}
          </section>
        </Reveal>
        <Reveal order={6}>
          <section className="h-full rounded-2xl border bg-card p-5 shadow-md md:p-6">
            <h2 className="font-semibold">{dict.report.keyStats}</h2>
            <KeyStats profile={profile} dict={dict} intl={intl} />
          </section>
        </Reveal>
      </div>

      {/* Similar players */}
      <Reveal order={7}>
        <section className="rounded-2xl border bg-card shadow-md" aria-labelledby="similar">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b p-5 md:px-6">
            <div>
              <h2 id="similar" className="flex items-center gap-2 font-semibold">
                <Users className="size-4 text-muted-foreground" aria-hidden />
                {interpolate(dict.report.similarPlayers, { name: player })}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{dict.report.similarNote}</p>
            </div>
          </div>
          {similar.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{dict.table.empty}</p>
          ) : (
            <ul className="grid sm:grid-cols-2 xl:grid-cols-4">
              {similar.map((s) => (
                <li key={s.Player} className="border-b sm:odd:border-e xl:border-e xl:[&:nth-child(4n)]:border-e-0">
                  <Link href={playerHref(locale, s.Player)} className="flex items-center gap-3 p-4 transition-colors hover:bg-accent">
                    <Monogram name={s.Player} position={s.Position} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.Player}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[s.Squad, s.League].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-end">
                      <span className="block text-sm font-semibold">{formatNumber(s.similarity_pct, intl, 1)}%</span>
                      <span className="block text-[0.65rem] text-muted-foreground">{dict.table.similarity}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </div>
  )
}

function AxisList({ title, items, tone, empty }: { title: string; items: { label: string; value: number }[]; tone: string; empty?: string }) {
  return (
    <div>
      <h3 className={cn("text-sm font-semibold", tone)}>{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {items.map((a) => (
            <AxisItem key={a.label} label={a.label} value={a.value} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AxisItem({ label: raw, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between gap-3">
      <AxisName raw={raw} />
      <span className="font-medium">{value.toFixed(0)}</span>
    </li>
  )
}


function KeyStats({ profile, dict, intl }: { profile: Profile; dict: Dictionary; intl: string }) {
  const rows: [string, string][] = [
    [dict.stats.goals_p90, formatNumber(profile.goals_p90, intl)],
    [dict.stats.assists_p90, formatNumber(profile.assists_p90, intl)],
    [dict.stats.shots_p90, formatNumber(profile.shots_p90, intl)],
    [dict.stats.shot_accuracy_pct, formatPct(profile.shot_accuracy_pct, intl)],
    [dict.stats.tackles_won_p90, formatNumber(profile.tackles_won_p90, intl)],
    [dict.stats.interceptions_p90, formatNumber(profile.interceptions_p90, intl)],
    [dict.stats.availability_pct, formatPct(profile.availability_pct, intl)],
  ]
  return (
    <dl className="mt-3 divide-y text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-1.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium" title={v === "—" ? dict.stats.missing : undefined}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <BlockSkeleton className="h-64 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <BlockSkeleton className="h-96" />
        <BlockSkeleton className="h-96" />
      </div>
    </div>
  )
}

