"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api/client"
import { playerRowsSchema, type PlayerRow } from "@/lib/api/schemas"
import { formatEuro } from "@/lib/format"
import { playerHref } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { interpolate, label } from "@/i18n/translate"
import { Monogram } from "./bits"

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function usePlayerSearch(q: string) {
  const query = useDebounced(q.trim(), 200)
  return useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => api("/players", playerRowsSchema, { query: { q: query, top_n: 8 }, signal }),
    enabled: query.length >= 2,
    placeholderData: (prev) => prev,
  })
}

type Props = {
  /** Called with the chosen player. Defaults to opening their report. */
  onSelect?: (player: PlayerRow) => void
  placeholder?: string
  size?: "lg" | "md"
  autoFocus?: boolean
  className?: string
  defaultValue?: string
}

/** Accessible combobox over GET /players. Arrow keys move, Enter opens. */
export function PlayerSearch({ onSelect, placeholder, size = "md", autoFocus, className, defaultValue = "" }: Props) {
  const { dict, locale, intl } = useI18n()
  const router = useRouter()
  const listId = useId()
  const [q, setQ] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, isFetching } = usePlayerSearch(q)
  const results = q.trim().length >= 2 ? (data ?? []) : []

  const choose = (p: PlayerRow) => {
    setOpen(false)
    if (onSelect) {
      setQ(p.Player)
      onSelect(p)
    } else {
      setQ("")
      router.push(playerHref(locale, p.Player))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const showPanel = open && q.trim().length > 0
  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-input bg-card text-card-foreground shadow-md transition-[box-shadow,border-color] duration-300 ease-out-expo focus-within:border-ring focus-within:shadow-lg",
          size === "lg" ? "h-14 px-4 text-base" : "h-10 px-3 text-sm"
        )}
      >
        {isFetching ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className={cn("shrink-0 text-muted-foreground", size === "lg" ? "size-5" : "size-4")} aria-hidden />
        )}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={dict.desk.searchLabel}
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={q}
          placeholder={placeholder ?? dict.desk.searchPlaceholder}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full z-40 mt-2 origin-top overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
          >
            {q.trim().length < 2 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{dict.desk.minChars}</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {isFetching ? dict.desk.searching : interpolate(dict.desk.noResults, { q: q.trim() })}
              </p>
            ) : (
              <ul id={listId} role="listbox" className="max-h-80 overflow-auto p-1.5">
                {results.map((p, i) => (
                  <li
                    key={p.Player}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      choose(p)
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors",
                      i === active && "bg-accent"
                    )}
                  >
                    <Monogram name={p.Player} position={p.Position} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="block truncate text-start text-sm font-medium">{p.Player}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[label(dict.positions, p.Position), p.Squad, p.League].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatEuro(p.market_value_eur, intl)}</span>
                    <span className="w-9 text-end text-sm font-semibold">{p.predicted_talent?.toFixed(0) ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
