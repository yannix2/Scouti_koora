import { Suspense } from "react"
import type { Metadata } from "next"
import { Compare } from "@/features/compare/compare"
import { BlockSkeleton, PageFrame, PageHeader } from "@/components/shell/page"
import { getDictionary } from "@/i18n/dictionaries"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return { title: dict.compare.title, description: dict.compare.subtitle }
}

export default async function ComparePage() {
  const dict = await getDictionary()
  return (
    <PageFrame>
      <PageHeader title={dict.compare.title} subtitle={dict.compare.subtitle} />
      <Suspense fallback={<BlockSkeleton className="h-[32rem] w-full" />}>
        <Compare />
      </Suspense>
    </PageFrame>
  )
}
