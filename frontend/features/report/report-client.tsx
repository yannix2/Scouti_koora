"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddToListButton, SaveButton } from "@/components/player/player-actions"
import { useTrack } from "@/features/scouting/use-scouting"
import { useSession } from "@/features/auth/use-session"
import { useI18n } from "@/i18n/client"

/** Logs one "view" per report open for signed-in scouts (feeds personalized recs and trending). */
export function TrackView({ name }: { name: string }) {
  const { data: user } = useSession()
  const track = useTrack()
  const done = useRef(false)
  useEffect(() => {
    if (user && !done.current) {
      done.current = true
      track(name, "view")
    }
  }, [user, name, track])
  return null
}

export function ReportActions({ name }: { name: string }) {
  const { dict, locale } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton name={name} variant="full" />
      <AddToListButton name={name} />
      <Button asChild variant="outline" size="lg">
        <Link href={`/${locale}/compare?a=${encodeURIComponent(name)}`}>
          <ArrowLeftRight data-icon="inline-start" />
          {dict.actions.compareWith}
        </Link>
      </Button>
    </div>
  )
}
