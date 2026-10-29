"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"
import { api, enc } from "@/lib/api/client"
import { historySchema, listDetailSchema, listSchema, listsSchema, personalizedSchema, savedSchema } from "@/lib/api/schemas"
import { useSession } from "@/features/auth/use-session"
import { useI18n } from "@/i18n/client"
import { interpolate } from "@/i18n/translate"

const ok = z.any()

export function useSaved() {
  const { data: user } = useSession()
  return useQuery({
    queryKey: ["scouting", "saved"],
    queryFn: () => api("/scouting/saved", savedSchema),
    enabled: !!user,
  })
}

export function useToggleSave() {
  const qc = useQueryClient()
  const { dict } = useI18n()
  return useMutation({
    mutationFn: async ({ name, saved }: { name: string; saved: boolean }) => {
      if (saved) await api(`/scouting/saved/${enc(name)}`, ok, { method: "DELETE" })
      else await api("/scouting/saved", ok, { method: "POST", body: { player_name: name } })
      return { name, saved }
    },
    onSuccess: ({ name, saved }) => {
      qc.invalidateQueries({ queryKey: ["scouting", "saved"] })
      toast.success(interpolate(saved ? dict.actions.removedToast : dict.actions.savedToast, { name }))
    },
    onError: () => toast.error(dict.actions.error),
  })
}

export function useLists() {
  const { data: user } = useSession()
  return useQuery({ queryKey: ["scouting", "lists"], queryFn: () => api("/scouting/lists", listsSchema), enabled: !!user })
}

export function useList(id: string) {
  return useQuery({ queryKey: ["scouting", "lists", id], queryFn: () => api(`/scouting/lists/${enc(id)}`, listDetailSchema) })
}

export function useCreateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string; is_public: boolean }) =>
      api("/scouting/lists", listSchema, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouting", "lists"] }),
  })
}

export function useUpdateList(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; description?: string; is_public?: boolean }) =>
      api(`/scouting/lists/${enc(id)}`, listSchema, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouting", "lists"] }),
  })
}

export function useDeleteList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/scouting/lists/${enc(id)}`, ok, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouting", "lists"] }),
  })
}

export function useAddToList() {
  const qc = useQueryClient()
  const { dict } = useI18n()
  return useMutation({
    mutationFn: async ({ listId, listName, name }: { listId: string; listName: string; name: string }) => {
      await api(`/scouting/lists/${enc(listId)}/items`, ok, { method: "POST", body: { player_name: name } })
      return { listName, name }
    },
    onSuccess: ({ listName, name }, { listId }) => {
      qc.invalidateQueries({ queryKey: ["scouting", "lists", listId] })
      toast.success(interpolate(dict.actions.addedToList, { name, list: listName }))
    },
    onError: () => toast.error(dict.actions.error),
  })
}

export function useRemoveFromList(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api(`/scouting/lists/${enc(listId)}/items/${enc(itemId)}`, ok, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouting", "lists", listId] }),
  })
}

export function useHistory() {
  const { data: user } = useSession()
  return useQuery({ queryKey: ["scouting", "history"], queryFn: () => api("/scouting/history", historySchema), enabled: !!user })
}

export function usePersonalized() {
  const { data: user } = useSession()
  return useQuery({
    queryKey: ["scouting", "personalized"],
    queryFn: () => api("/recommendations/personalized", personalizedSchema, { query: { limit: 12 } }),
    enabled: !!user,
  })
}

export function useTrack() {
  const { data: user } = useSession()
  const qc = useQueryClient()
  return (name: string, interaction_type: "view" | "save" | "compare" | "search") => {
    if (!user) return
    api("/scouting/track", ok, { method: "POST", body: { player_name: name, interaction_type } })
      .then(() => qc.invalidateQueries({ queryKey: ["scouting", "history"] }))
      .catch(() => {})
  }
}
