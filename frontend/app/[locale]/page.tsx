import { Suspense } from "react"
import { connection } from "next/server"
import { ScoutDesk } from "@/features/desk/scout-desk"
import { BlockSkeleton, ErrorPanel, PageFrame, PageHeader } from "@/components/shell/page"
import { getHiddenGems, getProfile, getTopTalent, getTrending } from "@/lib/api/server"
import { codeToApiPosition } from "@/lib/players"
import { getDictionary } from "@/i18n/dictionaries"
import { interpolate } from "@/i18n/translate"

export default async function DeskPage() {
  const dict = await getDictionary()
  return (
    <PageFrame>
      <PageHeader
        title={dict.desk.title}
        subtitle={interpolate(dict.coverage, { players: "4,817" })}
      />
      <Suspense fallback={<DeskSkeleton />}>
        <DeskData />
      </Suspense>
    </PageFrame>
  )
}

async function DeskData() {
  // Data is read per request (cached per function), so the build never depends on the backend being up.
  await connection()
  const dict = await getDictionary()
  try {
    const [all, FW, MF, DF, GK, gems] = await Promise.all([
      getTopTalent(),
      getTopTalent(codeToApiPosition.FW),
      getTopTalent(codeToApiPosition.MF),
      getTopTalent(codeToApiPosition.DF),
      getTopTalent(codeToApiPosition.GK),
      getHiddenGems(),
    ])
    // Trending only returns names and counts; look up positions (cached) so they can be marked on the pitch.
    const views = await getTrending().catch(() => [])
    const trending = await Promise.all(
      views.slice(0, 8).map(async (t) => ({ ...t, Position: (await getProfile(t.Player).catch(() => null))?.Position ?? null }))
    )
    return <ScoutDesk talent={{ all, FW, MF, DF, GK }} gems={gems} trending={trending} />
  } catch {
    return <ErrorPanel message={dict.desk.backendDown} />
  }
}

function DeskSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(24rem,1fr)]">
      <BlockSkeleton className="aspect-[111/74] w-full" />
      <BlockSkeleton className="h-[34rem] w-full" />
    </div>
  )
}
