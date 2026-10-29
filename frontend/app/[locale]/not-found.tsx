import Link from "next/link"
import { getDictionary, getLocale } from "@/i18n/dictionaries"
import { PageFrame } from "@/components/shell/page"

export default async function NotFound() {
  const dict = await getDictionary()
  const locale = await getLocale()
  return (
    <PageFrame className="grid min-h-[60dvh] place-items-center">
      <div className="text-center">
        <p className="text-6xl font-semibold tracking-tight text-turf">404</p>
        <h1 className="mt-3 text-xl font-semibold">{dict.common.notFound}</h1>
        <Link href={`/${locale}`} className="mt-4 inline-block text-sm font-medium underline">
          {dict.common.home}
        </Link>
      </div>
    </PageFrame>
  )
}
