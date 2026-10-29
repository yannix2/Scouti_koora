import { Suspense } from "react"
import type { Metadata } from "next"
import { Discover } from "@/features/discover/discover"
import { BlockSkeleton, PageFrame, PageHeader } from "@/components/shell/page"
import { getDictionary } from "@/i18n/dictionaries"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return { title: dict.discover.title, description: dict.discover.subtitle }
}

export default async function DiscoverPage() {
  const dict = await getDictionary()
  return (
    <PageFrame>
      <PageHeader title={dict.discover.title} subtitle={dict.discover.subtitle} />
      {/* Filters live in the URL (search params), so the client part streams in after the static shell. */}
      <Suspense fallback={<BlockSkeleton className="h-[36rem] w-full" />}>
        <Discover />
      </Suspense>
    </PageFrame>
  )
}
