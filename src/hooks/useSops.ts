import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actOnNoteStep,
  controlNoteExecution,
  decideNoteApproval,
  getNoteSop,
  getSop,
  listNoteExecutions,
  listSopExecutions,
  listSops,
  startNoteExecution,
  type Execution,
  type StepAction,
} from '../api/sops'

export const sopKeys = {
  all: ['sops'] as const,
  detail: (id: string) => ['sops', id] as const,
  executions: (id: string) => ['sops', id, 'executions'] as const,
  noteSop: (noteId: string) => ['notes', noteId, 'sop'] as const,
  noteRuns: (noteId: string) => ['notes', noteId, 'runbooks'] as const,
}

export const useSops = () => useQuery({ queryKey: sopKeys.all, queryFn: listSops })

export const useSop = (id: string | null) =>
  useQuery({ queryKey: sopKeys.detail(id ?? ''), queryFn: () => getSop(id!), enabled: Boolean(id) })

export const useSopExecutions = (id: string | null) =>
  useQuery({ queryKey: sopKeys.executions(id ?? ''), queryFn: () => listSopExecutions(id!), enabled: Boolean(id) })

export const useNoteSop = (noteId: string) =>
  useQuery({ queryKey: sopKeys.noteSop(noteId), queryFn: () => getNoteSop(noteId), staleTime: 0 })

export const useNoteExecutions = (noteId: string) =>
  useQuery({ queryKey: sopKeys.noteRuns(noteId), queryFn: () => listNoteExecutions(noteId), staleTime: 0 })

/** Every execution action returns the updated execution; swap it into the cached list. */
function useExecutionMutation<V>(noteId: string, fn: (vars: V) => Promise<Execution>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (run) => {
      qc.setQueryData<Execution[]>(sopKeys.noteRuns(noteId), (runs) =>
        runs?.some((r) => r.id === run.id) ? runs.map((r) => (r.id === run.id ? run : r)) : [...(runs ?? []), run],
      )
      qc.invalidateQueries({ queryKey: sopKeys.noteSop(noteId) })
    },
  })
}

export function useNoteExecutionActions(noteId: string) {
  return {
    start: useExecutionMutation(noteId, (sopId: string) => startNoteExecution(noteId, sopId)),
    control: useExecutionMutation(noteId, (v: { runId: string; status?: 'SKIPPED'; goToStep?: string }) =>
      controlNoteExecution(noteId, v.runId, { status: v.status, goToStep: v.goToStep }),
    ),
    act: useExecutionMutation(noteId, (v: { runId: string; stepId: string; body: StepAction }) =>
      actOnNoteStep(noteId, v.runId, v.stepId, v.body),
    ),
    decide: useExecutionMutation(
      noteId,
      (v: { runId: string; stepId: string; decision: 'APPROVED' | 'REJECTED'; comment?: string }) =>
        decideNoteApproval(noteId, v.runId, v.stepId, { decision: v.decision, comment: v.comment }),
    ),
  }
}
