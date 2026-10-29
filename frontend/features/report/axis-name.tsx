"use client"

import { useAxisLabel } from "./radar-chart"

export function AxisName({ raw }: { raw: string }) {
  const axisLabel = useAxisLabel()
  return <span className="text-muted-foreground">{axisLabel(raw)}</span>
}
