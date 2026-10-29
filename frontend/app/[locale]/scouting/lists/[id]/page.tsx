import { Suspense } from "react"
import type { Metadata } from "next"
import { ListDetail } from "@/features/scouting/list-detail"
import { BlockSkeleton, PageFrame } from "@/components/shell/page"
import { getDictionary } from "@/i18n/dictionaries"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).scouting.lists, robots: { index: false } }
}

export default function ListPage({ params }: PageProps<"/[locale]/scouting/lists/[id]">) {
  return (
    <PageFrame>
      <Suspense fallback={<BlockSkeleton className="h-96 w-full" />}>
        <ListBody params={params} />
      </Suspense>
    </PageFrame>
  )
}

async function ListBody({ params }: { params: PageProps<"/[locale]/scouting/lists/[id]">["params"] }) {
  const { id } = await params
  return <ListDetail id={id} />
}
