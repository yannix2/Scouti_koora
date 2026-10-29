"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

const EASE = [0.16, 1, 0.3, 1] as const

/** One shared entrance: content rises 10px and un-blurs, staggered by `order`. Visible by default under reduced motion. */
export function Reveal({ children, order = 0, className, as = "div" }: { children: ReactNode; order?: number; className?: string; as?: "div" | "section" | "li" }) {
  const Comp = motion[as]
  return (
    <Comp
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.05 + order * 0.07 }}
      className={className}
    >
      {children}
    </Comp>
  )
}

/** A bar that paints itself to length, like a line-marking machine. */
export function PaintBar({ value, className, tone = "bg-turf", delay = 0 }: { value: number; className?: string; tone?: string; delay?: number }) {
  return (
    <span className={`relative block h-2 overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      <motion.span
        className={`absolute inset-y-0 start-0 rounded-full ${tone}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.2 + delay }}
      />
    </span>
  )
}
