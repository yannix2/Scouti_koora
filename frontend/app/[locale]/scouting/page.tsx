import type { Metadata } from "next"
import { Scouting } from "@/features/scouting/scouting"
import { PageFrame, PageHeader } from "@/components/shell/page"
import { getDictionary } from "@/i18n/dictionaries"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).scouting.title, robots: { index: false } }
}

export default async function ScoutingPage() {
  const dict = await getDictionary()
  return (
    <PageFrame>
      <PageHeader title={dict.scouting.title} />
      <Scouting />
    </PageFrame>
  )
}
