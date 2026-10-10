import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getSop, getSopMeta, listNoteExecutions, listSops } from '../api/sops'

export const sopKeys = {
  meta: ['sop-meta'] as const,
  list: ['sops'] as const,
  detail: (id: string) => ['sops', id] as const,
  publish: (id: string) => ['sops', id, 'publish'] as const,
  noteExecutions: (noteId: string) => ['note-executions', noteId] as const,
  assignments: (scope: string, id: string) => ['sop-assignments', scope, id] as const,
}

/** The engine's vocabulary (step types, fields, operators, triggers, actions). Never changes at runtime. */
export function useSopMeta() {
  return useQuery({ queryKey: sopKeys.meta, queryFn: getSopMeta, staleTime: Infinity })
}

export function useSopList() {
  return useQuery({ queryKey: sopKeys.list, queryFn: listSops })
}

export function useSop(id: string | null) {
  return useQuery({ queryKey: sopKeys.detail(id ?? ''), queryFn: () => getSop(id!), enabled: !!id })
}

export function useNoteExecutions(noteId: string) {
  return useQuery({ queryKey: sopKeys.noteExecutions(noteId), queryFn: () => listNoteExecutions(noteId), staleTime: 0 })
}

/** Refetches everything derived from an SOP definition after an edit. */
export function useInvalidateSop() {
  const queryClient = useQueryClient()
  return useCallback(
    (id?: string) => {
      queryClient.invalidateQueries({ queryKey: sopKeys.list })
      if (id) queryClient.invalidateQueries({ queryKey: sopKeys.detail(id) })
    },
    [queryClient],
  )
}
