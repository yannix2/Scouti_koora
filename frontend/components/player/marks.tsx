import { cn } from "@/lib/utils"

/** The pitch's own marks, as chalk on a turf swatch: dot = top talent, diamond = hidden gem, ring = trending. */
export function PitchMark({ kind, className }: { kind: "talent" | "gem" | "trending"; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-grid size-4 shrink-0 place-items-center rounded bg-pitch-a", className)}>
      {kind === "talent" && <span className="size-1.5 rounded-full bg-chalk-line" />}
      {kind === "gem" && <span className="size-1.5 rotate-45 rounded-[1px] bg-chalk-line" />}
      {kind === "trending" && <span className="size-2 rounded-full border-[1.5px] border-chalk-line" />}
    </span>
  )
}
