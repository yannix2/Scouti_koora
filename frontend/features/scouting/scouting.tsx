"use client"

import Link from "next/link"
import { useState } from "react"
import { motion } from "motion/react"
import { Bookmark, Clock, Crosshair, Eye, Globe, Lock, Plus, Search, Trash2, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Monogram } from "@/components/player/bits"
import { useSession } from "@/features/auth/use-session"
import { useCreateList, useHistory, useLists, usePersonalized, useSaved, useToggleSave } from "./use-scouting"
import { formatDate } from "@/lib/format"
import { playerHref } from "@/lib/players"
import { useI18n } from "@/i18n/client"
import { interpolate } from "@/i18n/translate"

const EASE = [0.16, 1, 0.3, 1] as const
const rise = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay: 0.05 + i * 0.07 },
})

export function Scouting() {
  const { dict } = useI18n()
  const { data: user, isLoading } = useSession()
  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (!user) return null
  return (
    <div className="flex flex-col gap-6">
      <motion.h2 {...rise(0)} className="text-lg font-medium text-muted-foreground">
        {interpolate(dict.scouting.welcome, { name: user.name.split(" ")[0] })}
      </motion.h2>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <motion.div {...rise(1)}>
          <ForYou />
        </motion.div>
        <motion.div {...rise(2)}>
          <SavedPlayers />
        </motion.div>
        <motion.div {...rise(3)} id="lists" className="scroll-mt-6">
          <Lists />
        </motion.div>
        <motion.div {...rise(4)}>
          <History />
        </motion.div>
      </div>
    </div>
  )
}

function Panel({ title, icon: Icon, note, action, children }: { title: string; icon: typeof Eye; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-md">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {title}
          </h2>
          {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  )
}

function Empty({ children, cta }: { children: React.ReactNode; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground">
      <p className="max-w-prose">{children}</p>
      {cta}
    </div>
  )
}

function Rows({ n }: { n: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

function ForYou() {
  const { dict, locale } = useI18n()
  const { data, isLoading } = usePersonalized()
  return (
    <Panel title={dict.scouting.forYou} icon={Crosshair} note={dict.scouting.forYouNote}>
      {isLoading ? (
        <Rows n={6} />
      ) : !data?.length ? (
        <Empty
          cta={
            <Button asChild variant="outline">
              <Link href={`/${locale}/discover`}>
                <Search data-icon="inline-start" />
                {dict.nav.discover}
              </Link>
            </Button>
          }
        >
          {dict.scouting.forYouEmpty}
        </Empty>
      ) : (
        <ul className="grid sm:grid-cols-2">
          {data.slice(0, 12).map((p, i) => (
            <li key={p.Player} className="border-b sm:odd:border-e">
              <Link href={playerHref(locale, p.Player)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent">
                <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                <Monogram name={p.Player} position={p.Position} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.Player}</span>
                {p.hybrid_score != null && (
                  <span className="text-end">
                    <span className="block text-sm font-semibold">{(p.hybrid_score * 100).toFixed(0)}</span>
                    <span className="block text-[0.65rem] text-muted-foreground">{dict.scouting.score}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function SavedPlayers() {
  const { dict, locale, intl } = useI18n()
  const { data, isLoading } = useSaved()
  const toggle = useToggleSave()
  return (
    <Panel title={dict.scouting.saved} icon={Bookmark}>
      {isLoading ? (
        <Rows n={4} />
      ) : !data?.length ? (
        <Empty>{dict.scouting.savedEmpty}</Empty>
      ) : (
        <ul className="divide-y">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
              <Monogram name={s.player_name} size="sm" />
              <Link href={playerHref(locale, s.player_name)} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                {s.player_name}
              </Link>
              <span className="text-xs text-muted-foreground">{formatDate(s.created_at, intl)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${dict.actions.unsave}: ${s.player_name}`}
                onClick={() => toggle.mutate({ name: s.player_name, saved: true })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function NewListDialog() {
  const { dict } = useI18n()
  const create = useCreateList()
  const [open, setOpen] = useState(false)
  const [isPublic, setPublic] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          {dict.scouting.newList}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            create.mutate(
              { name: String(f.get("name")), description: String(f.get("description") || "") || undefined, is_public: isPublic },
              { onSuccess: () => setOpen(false) }
            )
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{dict.scouting.newList}</DialogTitle>
            <DialogDescription>{dict.scouting.listsEmpty}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-name">{dict.scouting.listName}</Label>
            <Input id="list-name" name="name" required maxLength={80} className="h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-desc">{dict.scouting.listDescription}</Label>
            <Input id="list-desc" name="description" maxLength={200} className="h-10" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isPublic} onCheckedChange={setPublic} />
            {dict.scouting.public}
          </label>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {dict.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Lists() {
  const { dict, locale, intl } = useI18n()
  const { data, isLoading } = useLists()
  return (
    <Panel title={dict.scouting.lists} icon={Bookmark} action={<NewListDialog />}>
      {isLoading ? (
        <Rows n={3} />
      ) : !data?.length ? (
        <Empty>{dict.scouting.listsEmpty}</Empty>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {data.map((l) => (
            <li key={l.id}>
              <Link
                href={`/${locale}/scouting/lists/${l.id}`}
                className="flex h-full flex-col gap-2 rounded-xl border bg-background p-4 shadow-xs transition-[box-shadow,translate] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{l.name}</span>
                  {l.is_public ? <Globe className="size-3.5 text-muted-foreground" /> : <Lock className="size-3.5 text-muted-foreground" />}
                </span>
                {l.description && <span className="line-clamp-2 text-xs text-muted-foreground">{l.description}</span>}
                <span className="mt-auto text-xs text-muted-foreground">{formatDate(l.created_at, intl)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function History() {
  const { dict, locale, intl } = useI18n()
  const { data, isLoading } = useHistory()
  const icon = { view: Eye, save: Bookmark, compare: ArrowLeftRight, search: Search } as const
  return (
    <Panel title={dict.scouting.history} icon={Clock}>
      {isLoading ? (
        <Rows n={5} />
      ) : !data?.length ? (
        <Empty>{dict.scouting.historyEmpty}</Empty>
      ) : (
        <ol className="flex flex-col p-2">
          {data.slice(0, 12).map((h) => {
            const kind = (h.interaction_type in icon ? h.interaction_type : "view") as keyof typeof icon
            const Icon = icon[kind]
            return (
              <li key={h.id}>
                <Link href={playerHref(locale, h.player_name)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">{dict.scouting.interaction[kind]}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{h.player_name}</span>
                  <time className="text-xs text-muted-foreground" dateTime={h.created_at}>
                    {formatDate(h.created_at, intl)}
                  </time>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
