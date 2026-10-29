"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, ArrowLeftRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Monogram } from "@/components/player/bits"
import { useDeleteList, useList, useRemoveFromList, useUpdateList } from "./use-scouting"
import { formatDate } from "@/lib/format"
import { playerHref } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { interpolate } from "@/i18n/translate"

export function ListDetail({ id }: { id: string }) {
  const { dict, locale, intl } = useI18n()
  const router = useRouter()
  const { data, isLoading, isError } = useList(id)
  const update = useUpdateList(id)
  const remove = useRemoveFromList(id)
  const del = useDeleteList()
  const [picked, setPicked] = useState<string[]>([])

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (isError || !data) return <p className="rounded-2xl border p-8 text-sm text-flag-ink">{dict.actions.error}</p>

  const togglePick = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p.slice(-1), name]))

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/${locale}/scouting`} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {dict.scouting.title}
      </Link>

      <section className="rounded-2xl border bg-card p-5 shadow-lg md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <form
            className="min-w-64 flex-1"
            onSubmit={(e) => {
              e.preventDefault()
              const name = String(new FormData(e.currentTarget).get("name")).trim()
              if (name && name !== data.name) update.mutate({ name })
            }}
          >
            <label htmlFor="list-title" className="sr-only">
              {dict.scouting.listName}
            </label>
            <Input
              id="list-title"
              name="name"
              defaultValue={data.name}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-auto border-transparent bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:border-input md:text-2xl"
            />
            {data.description && <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{interpolate(data.items.length === 1 ? dict.scouting.playersOne : dict.scouting.players, { n: data.items.length })}</p>
          </form>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={data.is_public} onCheckedChange={(v) => update.mutate({ is_public: v })} />
              {dict.scouting.public}
            </label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 data-icon="inline-start" />
                  {dict.actions.delete}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{dict.scouting.deleteList}</AlertDialogTitle>
                  <AlertDialogDescription>{interpolate(dict.scouting.deleteListBody, { name: data.name })}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{dict.actions.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate(id, { onSuccess: () => router.push(`/${locale}/scouting`) })}>
                    {dict.actions.delete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-md">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <p className="text-sm text-muted-foreground">{dict.actions.compare}: {picked.length}/2</p>
          <Button asChild size="sm" variant="outline" disabled={picked.length !== 2} aria-disabled={picked.length !== 2}>
            <Link
              href={picked.length === 2 ? `/${locale}/compare?a=${encodeURIComponent(picked[0])}&b=${encodeURIComponent(picked[1])}` : "#"}
              className={picked.length !== 2 ? "pointer-events-none opacity-50" : undefined}
            >
              <ArrowLeftRight data-icon="inline-start" />
              {dict.actions.compare}
            </Link>
          </Button>
        </div>
        {data.items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{dict.scouting.listEmpty}</p>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {data.items.map((item, i) => (
                <motion.li
                  layout
                  key={item.id}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex items-center gap-3 border-t border-border/60 px-5 py-2.5 ${i % 2 ? "bg-stripe-b" : "bg-stripe-a"}`}
                >
                  <Checkbox
                    checked={picked.includes(item.player_name)}
                    onCheckedChange={() => togglePick(item.player_name)}
                    aria-label={`${dict.actions.compare}: ${item.player_name}`}
                  />
                  <Monogram name={item.player_name} size="sm" />
                  <Link href={playerHref(locale, item.player_name)} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                    {item.player_name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDate(item.created_at, intl)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`${dict.actions.remove}: ${item.player_name}`} onClick={() => remove.mutate(item.id)}>
                    <Trash2 />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  )
}
