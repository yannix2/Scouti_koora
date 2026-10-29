import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthForm } from "@/features/auth/auth-form"
import { getDictionary } from "@/i18n/dictionaries"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.signIn, robots: { index: false } }
}

export default function LoginPage() {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-10">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  )
}
