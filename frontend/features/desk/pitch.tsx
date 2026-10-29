"use client"

import { useMemo, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { hash01, toCode, type PositionCode } from "@/lib/players"

export type PitchPlayer = { name: string; position?: string | null; score?: number | null; kind: "talent" | "gem" }

// FIFA pitch in metres: 105 × 68. Every marking is one path so it can be "painted" with pathLength.
const LINES = [
  "M0,0 H105 V68 H0 Z",
  "M52.5,0 V68",
  "M0,13.84 H16.5 V54.16 H0",
  "M0,24.84 H5.5 V43.16 H0",
  "M16.5,26.69 A9.15,9.15 0 0,1 16.5,41.31",
  "M105,13.84 H88.5 V54.16 H105",
  "M105,24.84 H99.5 V43.16 H105",
  "M88.5,26.69 A9.15,9.15 0 0,0 88.5,41.31",
  "M0,1 A1,1 0 0,0 1,0",
  "M104,0 A1,1 0 0,0 105,1",
  "M105,67 A1,1 0 0,0 104,68",
  "M1,68 A1,1 0 0,0 0,67",
  "M0,30.34 H-1.6 V37.66 H0",
  "M105,30.34 H106.6 V37.66 H105",
]
const SPOTS: [number, number][] = [
  [52.5, 34],
  [11, 34],
  [94, 34],
]

// Zones run own goal (left) to attack (right); RTL mirrors the direction of play.
const ZONES: Record<PositionCode, [number, number]> = { GK: [3.5, 7.5], DF: [15, 31], MF: [36, 69], FW: [74, 95] }
const ZONE_ORDER: PositionCode[] = ["GK", "DF", "MF", "FW"]
const STRIPES = 12
const EASE = [0.16, 1, 0.3, 1] as const

type Placed = PitchPlayer & { x: number; y: number; code: PositionCode }

/** Spread each zone's players over free rows, keeping the centre band clear for the search field. */
function place(players: PitchPlayer[], rtl: boolean): Placed[] {
  const byZone = new Map<PositionCode, PitchPlayer[]>()
  for (const p of players) {
    const code = toCode(p.position) ?? "MF"
    byZone.set(code, [...(byZone.get(code) ?? []), p])
  }
  const out: Placed[] = []
  for (const code of ZONE_ORDER) {
    const list = (byZone.get(code) ?? []).sort((a, b) => hash01(a.name) - hash01(b.name))
    const [x0, x1] = ZONES[code]
    // The search field covers y≈27–41 across the outfield zones; goalkeepers sit beside it.
    const segments: [number, number][] = code === "GK" ? [[18, 50]] : [[5, 24], [44, 63]]
    const total = segments.reduce((sum, [a, b]) => sum + (b - a), 0)
    list.forEach((p, i) => {
      let t = ((i + 0.5) / list.length) * total
      let y = segments[0][0]
      for (const [a, b] of segments) {
        if (t <= b - a) {
          y = a + t
          break
        }
        t -= b - a
      }
      // Alternate two lanes so neighbouring labels never sit on top of each other.
      const lane = code === "GK" ? 0.5 : i % 2 ? 0.74 : 0.26
      const x = x0 + (x1 - x0) * (lane + (hash01(p.name + "x") - 0.5) * 0.14)
      out.push({ ...p, code, x: rtl ? 105 - x : x, y })
    })
  }
  return out
}

function surname(name: string) {
  const parts = name.split(" ")
  return parts.length > 1 ? parts.slice(1).join(" ") : name
}

export function Pitch({
  players,
  highlighted,
  onHover,
  onOpen,
  rtl,
  label,
  children,
}: {
  players: PitchPlayer[]
  highlighted: string | null
  onHover: (name: string | null) => void
  onOpen: (name: string) => void
  rtl: boolean
  label: string
  children?: ReactNode
}) {
  const reduce = useReducedMotion()
  const placed = useMemo(() => place(players, rtl), [players, rtl])
  const paint = (i: number) => (reduce ? { duration: 0 } : { duration: 1.1, delay: 0.15 + i * 0.07, ease: EASE })
  const linesDone = reduce ? 0 : 0.15 + LINES.length * 0.07 + 0.4

  return (
    <div className="relative isolate rounded-2xl shadow-xl">
      <svg viewBox="-3 -3 111 74" className="block h-auto w-full" role="img" aria-label={label}>
        <defs>
          <clipPath id="pitch-clip">
            <rect x="-3" y="-3" width="111" height="74" rx="2.5" />
          </clipPath>
        </defs>
        <g clipPath="url(#pitch-clip)">
          {Array.from({ length: STRIPES + 2 }, (_, i) => (
            <rect
              key={i}
              x={-3 + i * (111 / (STRIPES + 2))}
              y={-3}
              width={111 / (STRIPES + 2) + 0.05}
              height={74}
              className={i % 2 ? "fill-pitch-b" : "fill-pitch-a"}
            />
          ))}
        </g>

        <g fill="none" stroke="var(--chalk-line)" strokeWidth={0.32} strokeLinecap="round" strokeLinejoin="round" opacity={0.92}>
          {LINES.map((d, i) => (
            <motion.path key={d} d={d} initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={paint(i)} />
          ))}
          <motion.circle
            cx={52.5}
            cy={34}
            r={9.15}
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={paint(2)}
          />
        </g>
        {SPOTS.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={0.45}
            fill="var(--chalk-line)"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 0.92 }}
            transition={{ delay: reduce ? 0 : 0.5 + i * 0.1 }}
          />
        ))}

        <g>
          <AnimatePresence>
            {placed.map((p, i) => {
              const on = highlighted === p.name
              return (
                <motion.g
                  key={p.name + p.kind}
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.2 }}
                  animate={{ opacity: highlighted && !on ? 0.55 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ delay: reduce ? 0 : linesDone + i * 0.035, duration: 0.45, ease: EASE }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "view-box" }}
                  className="cursor-pointer outline-none"
                  tabIndex={-1}
                  onMouseEnter={() => onHover(p.name)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onOpen(p.name)}
                >
                  <title>{`${p.name}${p.score != null ? ` · ${p.score.toFixed(0)}` : ""}`}</title>
                  {on && (
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      r={1.2}
                      fill="none"
                      stroke="var(--flag)"
                      strokeWidth={0.35}
                      initial={{ r: 1.2, opacity: 0.9 }}
                      animate={{ r: 3.4, opacity: 0 }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  {p.kind === "gem" ? (
                    <motion.rect
                      x={p.x - 0.95}
                      y={p.y - 0.95}
                      width={1.9}
                      height={1.9}
                      rx={0.25}
                      transform={`rotate(45 ${p.x} ${p.y})`}
                      animate={{ fill: on ? "var(--flag)" : "var(--chalk-line)" }}
                      stroke="var(--turf-deep)"
                      strokeWidth={0.22}
                    />
                  ) : (
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      animate={{ r: on ? 1.45 : 1.05, fill: on ? "var(--flag)" : "var(--chalk-line)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      stroke="var(--turf-deep)"
                      strokeWidth={0.22}
                    />
                  )}
                  <text
                    x={p.x}
                    y={p.y + 3.1}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fill="var(--chalk-line)"
                    fontSize={on ? 2.1 : 1.75}
                    fontWeight={on ? 600 : 500}
                    opacity={on ? 1 : 0.85}
                    style={{ paintOrder: "stroke", stroke: "rgb(8 32 22 / 0.55)", strokeWidth: 0.5 }}
                  >
                    {on ? `${p.name}${p.score != null ? ` · ${p.score.toFixed(0)}` : ""}` : surname(p.name)}
                  </text>
                </motion.g>
              )
            })}
          </AnimatePresence>
        </g>
      </svg>
      {/* Centre-circle overlay (search) */}
      {children && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 14, filter: reduce ? "none" : "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: reduce ? 0 : 0.55, duration: 0.7, ease: EASE }}
          className="absolute inset-x-0 top-1/2 z-10 mx-auto w-[min(26rem,78%)] -translate-y-1/2"
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}
