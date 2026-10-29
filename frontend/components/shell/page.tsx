import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1480px] px-4 py-6 md:px-8 md:py-8", className)}>{children}</div>
}

export function ErrorPanel({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-flag/30 bg-card p-6 shadow-md">
      <AlertTriangle className="size-5 text-flag" aria-hidden />
      <p className="max-w-prose text-sm">{message}</p>
      {children}
    </div>
  )
}

export function BlockSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-2xl", className)} />
}
