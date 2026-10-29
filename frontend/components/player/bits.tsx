"use client"

import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import { toCode, type PositionCode } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { label } from "@/i18n/translate"

const posTone: Record<PositionCode, string> = {
  GK: "bg-pos-gk/12 text-pos-gk ring-pos-gk/25",
  DF: "bg-pos-df/12 text-pos-df ring-pos-df/25",
  MF: "bg-pos-mf/12 text-pos-mf ring-pos-mf/25",
  FW: "bg-pos-fw/12 text-pos-fw ring-pos-fw/25",
}

/** Initials in a position-coloured disc. Never presented as a photo: the data has none. */
export function Monogram({ name, position, size = "md" }: { name: string; position?: string | null; size?: "sm" | "md" | "lg" }) {
  const code = toCode(position) ?? "MF"
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight ring-1 ring-inset",
        posTone[code],
        size === "sm" && "size-8 text-[0.7rem]",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-16 text-xl"
      )}
    >
      {initials(name)}
    </span>
  )
}

export function PositionChip({ position, className }: { position?: string | null; className?: string }) {
  const { dict } = useI18n()
  const code = toCode(position)
  if (!code) return <span className="text-muted-foreground">—</span>
  return (
    <span
      title={label(dict.positions, position)}
      className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[0.7rem] font-semibold ring-1 ring-inset", posTone[code], className)}
    >
      {label(dict.positions, code)}
    </span>
  )
}

/** Talent score as a bold number on a thin chalk bar, like a line painted to length. */
export function TalentMeter({ value, className, bar = false }: { value?: number | null; className?: string; bar?: boolean; compact?: boolean }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <span className={cn("relative inline-flex items-center justify-end gap-2", className)}>
      {bar && (
        <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-muted">
          <span
            className="absolute inset-y-0 start-0 rounded-full bg-turf transition-[width] duration-700 ease-out-expo"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
      <span className="w-9 text-end font-semibold">{value == null ? "—" : value.toFixed(1)}</span>
    </span>
  )
}
