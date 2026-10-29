import { cn } from "@/lib/utils"
import { toCode, type PositionCode } from "@/lib/players"

// Same metre geometry as the desk pitch, reduced to the lines that locate a zone.
const ZONE: Record<PositionCode, [number, number]> = { GK: [0, 16.5], DF: [10, 38], MF: [33, 72], FW: [67, 105] }

/** The player's zone lit on a small marked pitch; direction of play mirrors in RTL via CSS. */
export function MiniPitch({ position, className }: { position?: string | null; className?: string }) {
  const code = toCode(position) ?? "MF"
  const [x0, x1] = ZONE[code]
  return (
    <svg viewBox="-2 -2 109 72" className={cn("h-auto w-full rtl:-scale-x-100", className)} aria-hidden>
      <rect x="-2" y="-2" width="109" height="72" rx="3" className="fill-pitch-a" />
      <rect x={x0} y={0} width={x1 - x0} height={68} className="fill-chalk-line" opacity={0.18} />
      <g fill="none" stroke="var(--chalk-line)" strokeWidth={0.8} opacity={0.9}>
        <rect x="0" y="0" width="105" height="68" />
        <path d="M52.5,0 V68 M0,13.84 H16.5 V54.16 H0 M105,13.84 H88.5 V54.16 H105" />
        <circle cx={52.5} cy={34} r={9.15} />
      </g>
      <circle cx={(x0 + x1) / 2} cy={34} r={3} className="fill-chalk-line" stroke="var(--turf-deep)" strokeWidth={0.8} />
    </svg>
  )
}
