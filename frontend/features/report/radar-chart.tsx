"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts"
import { useI18n } from "@/i18n/client"
import { label } from "@/i18n/translate"

type Axis = { label: string; value: number }

// Gateway axis labels are English; map them onto dictionary stat keys for FR/AR.
const AXIS_KEY: Record<string, string> = {
  "Goals p90": "goals_p90",
  "Assists p90": "assists_p90",
  "Shots p90": "shots_p90",
  "Shot Accuracy": "shot_accuracy_pct",
  "Conversion Rate": "conversion",
  "Tackles p90": "tackles_won_p90",
  "Interceptions p90": "interceptions_p90",
  "Def Actions p90": "def_actions_p90",
  Availability: "availability_pct",
  Discipline: "discipline",
}

export function useAxisLabel() {
  const { dict } = useI18n()
  const extra: Record<string, string> = { conversion: dict.report.axes.conversion, discipline: dict.report.axes.discipline }
  return (raw: string) => {
    const key = AXIS_KEY[raw]
    return key ? (extra[key] ?? label(dict.stats as Record<string, string>, key)) : raw
  }
}

type TickProps = { x?: number; y?: number; textAnchor?: "start" | "middle" | "end" | "inherit"; payload?: { value: string }; rtl?: boolean }

/** Two-line axis label: long names (Arabic especially) split at the middle space so neighbours never collide. */
function AxisTick({ x = 0, y = 0, textAnchor = "middle", payload, rtl }: TickProps) {
  const text = payload?.value ?? ""
  const words = text.split(" ")
  const lines = words.length > 1 && text.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [text]
  return (
    <text x={x} y={y} textAnchor={textAnchor} direction={rtl ? "rtl" : "ltr"} fontSize={rtl ? 10.5 : 11} fill="var(--muted-foreground)">
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (lines.length > 1 ? "-0.35em" : "0.35em") : "1.15em"}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function PerformanceRadar({ axes, compare, names }: { axes: Axis[]; compare?: Axis[]; names?: [string, string] }) {
  const { dict, dir } = useI18n()
  const axisLabel = useAxisLabel()
  // Radar ticks stay short: the "per 90" suffix is in the note, and long Arabic labels would collide.
  const data = axes.map((a, i) => ({ axis: axisLabel(a.label).replace(/ (p90|\/90|لكل 90)$/, ""), a: a.value, b: compare?.[i]?.value }))

  return (
    <div>
      <div className="h-[19rem] w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="68%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={<AxisTick rtl={dir === "rtl"} />} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "var(--elev-3)",
                fontSize: 12,
              }}
              formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v))}
            />
            <Radar
              name={names?.[0] ?? "a"}
              dataKey="a"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.28}
              strokeWidth={2}
              animationDuration={900}
              animationEasing="ease-out"
            />
            {compare && (
              <Radar
                name={names?.[1] ?? "b"}
                dataKey="b"
                stroke="var(--chart-4)"
                fill="var(--chart-4)"
                fillOpacity={0.18}
                strokeWidth={2}
                animationDuration={900}
                animationBegin={150}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <details className="group mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{dict.report.radarTable}</summary>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {data.map((d) => (
              <tr key={d.axis} className="border-t">
                <th scope="row" className="py-1 text-start font-normal text-muted-foreground">
                  {d.axis}
                </th>
                <td className="py-1 text-end font-medium">{d.a.toFixed(1)}</td>
                {compare && <td className="py-1 text-end font-medium">{d.b?.toFixed(1) ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
