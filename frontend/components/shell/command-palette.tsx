"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Compass, Gem, LayoutDashboard, Star } from "lucide-react"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { usePlayerSearch } from "@/components/player/player-search"
import { Monogram } from "@/components/player/bits"
import { playerHref } from "@/lib/players"
import { formatEuro } from "@/lib/format"
import { useI18n } from "@/i18n/client"
import { interpolate, label } from "@/i18n/translate"

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { dict, locale, intl } = useI18n()
  const router = useRouter()
  const [q, setQ] = useState("")
  const { data, isFetching } = usePlayerSearch(q)
  const players = q.trim().length >= 2 ? (data ?? []) : []

  const go = (href: string) => {
    onOpenChange(false)
    setQ("")
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={dict.nav.searchHint} description={dict.desk.searchLabel}>
      <CommandInput value={q} onValueChange={setQ} placeholder={dict.desk.searchPlaceholder} />
      <CommandList>
        {q.trim().length >= 2 && !isFetching && players.length === 0 && (
          <CommandEmpty>{interpolate(dict.desk.noResults, { q: q.trim() })}</CommandEmpty>
        )}
        {players.length > 0 && (
          <CommandGroup heading={dict.table.player}>
            {players.map((p) => (
              <CommandItem key={p.Player} value={`player:${p.Player}`} onSelect={() => go(playerHref(locale, p.Player))}>
                <Monogram name={p.Player} position={p.Position} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.Player}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[label(dict.positions, p.Position), p.Squad].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{formatEuro(p.market_value_eur, intl)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="ScoutiKoora">
          <CommandItem value="nav:desk" onSelect={() => go(`/${locale}`)}>
            <LayoutDashboard /> {dict.nav.desk}
          </CommandItem>
          <CommandItem value="nav:discover" onSelect={() => go(`/${locale}/discover`)}>
            <Compass /> {dict.nav.discover}
          </CommandItem>
          <CommandItem value="nav:gems" onSelect={() => go(`/${locale}/discover?tab=gems`)}>
            <Gem /> {dict.discover.tabs.gems}
          </CommandItem>
          <CommandItem value="nav:compare" onSelect={() => go(`/${locale}/compare`)}>
            <ArrowLeftRight /> {dict.nav.compare}
          </CommandItem>
          <CommandItem value="nav:scouting" onSelect={() => go(`/${locale}/scouting`)}>
            <Star /> {dict.nav.scouting}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
