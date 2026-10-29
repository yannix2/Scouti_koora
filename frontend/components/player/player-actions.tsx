"use client"

import Link from "next/link"
import { useState } from "react"
import { Bookmark, BookmarkCheck, ListPlus, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEnsureSession } from "@/features/auth/use-session"
import { useAddToList, useLists, useSaved, useToggleSave } from "@/features/scouting/use-scouting"
import { useI18n } from "@/i18n/client"

function useSignInPrompt() {
  const { dict, locale } = useI18n()
  return () =>
    toast(dict.actions.signInToSave, {
      action: { label: dict.nav.signIn, onClick: () => (window.location.href = `/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`) },
    })
}

export function SaveButton({ name, variant = "icon" }: { name: string; variant?: "icon" | "full" }) {
  const { dict } = useI18n()
  const ensureSession = useEnsureSession()
  const { data: saved } = useSaved()
  const toggle = useToggleSave()
  const prompt = useSignInPrompt()
  const isSaved = !!saved?.some((s) => s.player_name === name)
  const Icon = isSaved ? BookmarkCheck : Bookmark
  const onClick = async () => ((await ensureSession()) ? toggle.mutate({ name, saved: isSaved }) : prompt())
  const text = isSaved ? dict.actions.saved : dict.actions.save

  if (variant === "full")
    return (
      <Button variant={isSaved ? "secondary" : "default"} size="lg" onClick={onClick} disabled={toggle.isPending} aria-pressed={isSaved}>
        <Icon data-icon="inline-start" />
        {text}
      </Button>
    )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={toggle.isPending} aria-pressed={isSaved} aria-label={`${text}: ${name}`}>
          <Icon className={isSaved ? "text-turf" : undefined} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

export function AddToListButton({ name }: { name: string }) {
  const { dict, locale } = useI18n()
  const ensureSession = useEnsureSession()
  const { data: lists, isLoading } = useLists()
  const add = useAddToList()
  const prompt = useSignInPrompt()
  const [open, setOpen] = useState(false)

  // Always the same button on server and client; the session is checked when the menu opens.
  const onOpenChange = async (next: boolean) => {
    if (next && !(await ensureSession())) return prompt()
    setOpen(next)
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg">
          <ListPlus data-icon="inline-start" />
          {dict.actions.addToList}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{dict.scouting.lists}</DropdownMenuLabel>
        {isLoading ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{dict.common.loading}</p>
        ) : lists?.length ? (
          lists.map((l) => (
            <DropdownMenuItem key={l.id} onSelect={() => add.mutate({ listId: l.id, listName: l.name, name })}>
              {l.name}
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{dict.scouting.listsEmpty}</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/scouting#lists`}>
            <Plus />
            {dict.scouting.newList}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
