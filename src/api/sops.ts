import { jsonBody, request } from './http'

// ---------------------------------------------------------------------------
// Definitions (reusable SOP templates)
// ---------------------------------------------------------------------------

export const STEP_TYPES = [
  'INSTRUCTION',
  'CHECKLIST',
  'USER_ACTION',
  'APPROVAL',
  'TESTING',
  'GITHUB_ACTION',
  'CONDITION',
  'CONFIRMATION',
  'AUTOMATED_ACTION',
] as const
export type SopStepType = (typeof STEP_TYPES)[number]

export const OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'CONTAINS',
  'NOT_CONTAINS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'STARTS_WITH',
  'ENDS_WITH',
  'EXISTS',
  'NOT_EXISTS',
] as const
export type Operator = (typeof OPERATORS)[number]

export type ConditionLeaf = { field: string; operator: Operator; value?: unknown }
export type Condition = ConditionLeaf | { all: Condition[] } | { any: Condition[] } | { not: Condition }

export const RULE_TRIGGERS = [
  'EXECUTION_STARTED',
  'EXECUTION_COMPLETED',
  'STEP_STARTED',
  'STEP_COMPLETED',
  'STEP_FAILED',
  'STEP_BLOCKED',
  'STEP_SKIPPED',
  'NOTE_UPDATED',
  'ISSUE_UPDATED',
  'ISSUE_STATUS_CHANGED',
  'TASK_UPDATED',
] as const
export type RuleTrigger = (typeof RULE_TRIGGERS)[number]

export type SopAction =
  | { type: 'SET_ISSUE_STATUS'; status: string }
  | { type: 'SET_TASK_STATUS'; status: string }
  | { type: 'SET_RUNBOOK_STATUS'; status: 'FAILED' | 'BLOCKED' | 'SKIPPED' }
  | { type: 'GO_TO_STEP'; stepKey: string }
  | { type: 'SKIP_STEP'; stepKey: string }
  | { type: 'REQUIRE_APPROVALS'; stepKey: string; count: number }
  | { type: 'SET_STEP_CONFIG'; stepKey: string; config: Record<string, unknown> }
  | { type: 'ADD_LABEL'; label: string }
  | { type: 'REMOVE_LABEL'; label: string }
  | { type: 'ASSIGN_ISSUE'; userId: string | null }
  | { type: 'SET_ISSUE_FIELD'; field: string; value: unknown }
export type SopActionType = SopAction['type']

export interface UserRef {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface Sop {
  id: string
  userId: string
  workspaceId: string | null
  title: string
  content: string
  version: number
  createdAt: string
  updatedAt: string
  user?: UserRef
  steps?: SopStep[]
  rules?: SopRule[]
}

export interface SopStep {
  id: string
  sopId: string
  key: string
  position: number
  title: string
  description: string
  command: string | null
  requiresSignoff: boolean
  type: SopStepType
  config: Record<string, unknown>
  condition: Condition | null
}

export type SopStepInput = Partial<Omit<SopStep, 'id' | 'sopId' | 'condition'>> & {
  condition?: Condition | null
}

export interface SopRule {
  id: string
  sopId: string
  name: string
  trigger: RuleTrigger
  condition: Condition
  actions: SopAction[]
  enabled: boolean
}

export type SopRuleInput = Omit<SopRule, 'id' | 'sopId'>

export const listSops = () => request<{ sops: Sop[] }>('/api/sops').then((d) => d.sops)
export const getSop = (id: string) => request<{ sop: Sop }>(`/api/sops/${id}`).then((d) => d.sop)
export const createSop = (body: { title: string; content?: string }) =>
  request<{ sop: Sop }>('/api/sops', jsonBody('POST', body)).then((d) => d.sop)
export const updateSop = (id: string, body: { title?: string; content?: string }) =>
  request<{ sop: Sop }>(`/api/sops/${id}`, jsonBody('PATCH', body)).then((d) => d.sop)
export const deleteSop = (id: string) => request<unknown>(`/api/sops/${id}`, { method: 'DELETE' })

export const createStep = (sopId: string, body: SopStepInput) =>
  request<{ step: SopStep }>(`/api/sops/${sopId}/steps`, jsonBody('POST', body)).then((d) => d.step)
export const updateStep = (sopId: string, stepId: string, body: SopStepInput) =>
  request<{ step: SopStep }>(`/api/sops/${sopId}/steps/${stepId}`, jsonBody('PATCH', body)).then((d) => d.step)
export const deleteStep = (sopId: string, stepId: string) =>
  request<unknown>(`/api/sops/${sopId}/steps/${stepId}`, { method: 'DELETE' })
export const reorderSteps = (sopId: string, stepIds: string[]) =>
  request<{ steps: SopStep[] }>(`/api/sops/${sopId}/steps/order`, jsonBody('PUT', { stepIds })).then((d) => d.steps)

export const createRule = (sopId: string, body: SopRuleInput) =>
  request<{ rule: SopRule }>(`/api/sops/${sopId}/rules`, jsonBody('POST', body)).then((d) => d.rule)
export const updateRule = (sopId: string, ruleId: string, body: Partial<SopRuleInput>) =>
  request<{ rule: SopRule }>(`/api/sops/${sopId}/rules/${ruleId}`, jsonBody('PATCH', body)).then((d) => d.rule)
export const deleteRule = (sopId: string, ruleId: string) =>
  request<unknown>(`/api/sops/${sopId}/rules/${ruleId}`, { method: 'DELETE' })

export const evaluateCondition = (body: { condition: Condition; noteId?: string; context?: Record<string, unknown> }) =>
  request<{ result: boolean; context: Record<string, unknown> }>('/api/sops/conditions/evaluate', jsonBody('POST', body))

export interface ExecutionSummary {
  id: string
  status: ExecutionStatus
  assignmentType: AssignmentType | null
  sopVersion: number
  createdAt: string
  issue: { id: string; key: string; title: string } | null
  task: { id: string; title: string } | null
  note: { id: string; title: string } | null
  currentStep: { id: string; key: string; title: string; type: SopStepType; status: StepStatus } | null
  progress: { completed: number; total: number }
}

export const listSopExecutions = (sopId: string) =>
  request<{ executions: ExecutionSummary[] }>(`/api/sops/${sopId}/executions`).then((d) => d.executions)

// ---------------------------------------------------------------------------
// Executions (an SOP running against a note)
// ---------------------------------------------------------------------------

export type ExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'BLOCKED'
/** VERIFIED is the backend's "completed". */
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED' | 'BLOCKED' | 'SKIPPED'
export type AssignmentType = 'ENTITY_INHERITED' | 'TASK_OVERRIDE' | 'MANUAL'

export interface Approval {
  id: string
  userId: string
  user: UserRef
  decision: 'APPROVED' | 'REJECTED'
  comment: string
  attempt: number
  /** Counts toward the step's current attempt. */
  current: boolean
  createdAt: string
}

export interface RunStep {
  id: string
  key: string
  position: number
  title: string
  description: string
  command: string | null
  requiresSignoff: boolean
  type: SopStepType
  config: Record<string, unknown>
  condition: Condition | null
  status: StepStatus
  result: string | null
  data: { checkedItems?: string[] } & Record<string, unknown>
  attempt: number
  notes: string
  output: string
  executor: string | null
  completedBy: UserRef | null
  startedAt: string | null
  completedAt: string | null
  approvals: Approval[]
}

export interface RunEvent {
  id: string
  type: string
  actor: UserRef | null
  data: Record<string, unknown>
  createdAt: string
}

export interface Execution {
  id: string
  sopId: string | null
  sopVersion: number
  title: string
  mode: 'MANUAL' | 'AUTOMATED'
  status: ExecutionStatus
  assignmentType: AssignmentType | null
  currentStepId: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  steps: RunStep[]
  events: RunEvent[]
  progress: {
    completed: number
    total: number
    percent: number
    currentStepId: string | null
  }
}

export interface StepAction {
  status?: StepStatus
  notes?: string
  output?: string
  result?: string
  checkedItems?: string[]
}

export interface NoteSopResolution {
  assignment: {
    assignmentType: 'ENTITY_INHERITED' | 'TASK_OVERRIDE'
    sop: { id: string; title: string; version: number }
    source: { id: string; title: string } | null
  } | null
  defaultSop: { id: string; title: string; version: number } | null
  activeExecution: { id: string; status: ExecutionStatus } | null
}

const noteRuns = (noteId: string) => `/api/notes/${noteId}/runbooks`

export const getNoteSop = (noteId: string) => request<NoteSopResolution>(`/api/notes/${noteId}/sop`)
export const listNoteExecutions = (noteId: string) =>
  request<{ runbooks: Execution[] }>(noteRuns(noteId)).then((d) => d.runbooks)
export const startNoteExecution = (noteId: string, sopId: string) =>
  request<{ runbook: Execution }>(noteRuns(noteId), jsonBody('POST', { sopId })).then((d) => d.runbook)
export const controlNoteExecution = (noteId: string, runId: string, body: { status?: 'SKIPPED'; goToStep?: string }) =>
  request<{ runbook: Execution }>(`${noteRuns(noteId)}/${runId}`, jsonBody('PATCH', body)).then((d) => d.runbook)
export const actOnNoteStep = (noteId: string, runId: string, stepId: string, body: StepAction) =>
  request<{ runbook: Execution }>(`${noteRuns(noteId)}/${runId}/steps/${stepId}`, jsonBody('PATCH', body)).then(
    (d) => d.runbook,
  )
export const decideNoteApproval = (
  noteId: string,
  runId: string,
  stepId: string,
  body: { decision: 'APPROVED' | 'REJECTED'; comment?: string },
) =>
  request<{ runbook: Execution }>(
    `${noteRuns(noteId)}/${runId}/steps/${stepId}/approvals`,
    jsonBody('POST', body),
  ).then((d) => d.runbook)
