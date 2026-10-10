import { request } from './http'

// ---------------------------------------------------------------------------
// Conditions & actions (mirrors life-note-be src/lib/sop/conditions.ts)
// ---------------------------------------------------------------------------

export type Operator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IN'
  | 'NOT_IN'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'EXISTS'
  | 'NOT_EXISTS'

export type ConditionLeaf = { field: string; operator: Operator; value?: unknown }
export type Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition } | ConditionLeaf

export type SubjectStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'

export type SopAction =
  | { type: 'SET_SUBJECT_STATUS' | 'SET_ISSUE_STATUS'; status: SubjectStatus }
  | { type: 'SET_RUNBOOK_STATUS'; status: 'FAILED' | 'BLOCKED' | 'SKIPPED' }
  | { type: 'GOTO_STEP' | 'SKIP_STEP'; stepKey: string }
  | { type: 'ADD_LABEL' | 'REMOVE_LABEL'; label: string }
  | { type: 'SET_FIELD'; field: string; value: string | number | boolean | null }
  | { type: 'NOTIFY'; recipients: ('ASSIGNEE' | 'REPORTER' | 'WATCHERS' | 'OWNER')[]; userIds: string[]; message: string }

export type ActionType = SopAction['type']

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export type StepType =
  | 'INSTRUCTION'
  | 'CHECKLIST'
  | 'USER_ACTION'
  | 'APPROVAL'
  | 'TESTING'
  | 'GITHUB_ACTION'
  | 'CONDITION'
  | 'CONFIRMATION'
  | 'AUTOMATED_ACTION'

export interface ChecklistItem {
  key: string
  label: string
  required?: boolean
}

export interface ConfigOverride {
  when: Condition
  set: Record<string, unknown>
}

/** Union of every type's config keys; the backend validates per type. */
export interface StepConfig {
  overrides?: ConfigOverride[]
  mandatory?: boolean
  confirmationText?: string
  items?: ChecklistItem[]
  requiredApprovals?: number
  approverIds?: string[]
  approverRoles?: ('OWNER' | 'ADMIN' | 'MEMBER')[]
  preventSelfApproval?: boolean
  requireResult?: boolean
  check?: Condition
  onFalse?: 'FAIL' | 'BLOCK' | 'CONTINUE'
  onTrueGoto?: string
  onFalseGoto?: string
  event?: string
  repository?: string
  branch?: string
  workflow?: string
  action?: SopAction
  [key: string]: unknown
}

export interface SopStepDef {
  id: string
  sopId: string
  key: string
  position: number
  title: string
  description: string
  command: string | null
  requiresSignoff: boolean
  type: StepType
  config: StepConfig
  condition: Condition | null
}

export type RuleTrigger =
  | 'EXECUTION_STARTED'
  | 'STEP_STARTED'
  | 'STEP_COMPLETED'
  | 'STEP_FAILED'
  | 'STEP_SKIPPED'
  | 'STEP_BLOCKED'
  | 'EXECUTION_COMPLETED'
  | 'SUBJECT_STATUS_CHANGED'
  | 'SUBJECT_UPDATED'

export interface SopRule {
  id: string
  sopId: string
  name: string
  trigger: RuleTrigger
  condition: Condition | null
  actions: SopAction[]
  enabled: boolean
}

export interface UserRef {
  id: string
  name: string | null
  email: string
  image?: string | null
}

export interface SopSummary {
  id: string
  userId: string
  workspaceId: string | null
  title: string
  content: string
  version: number
  publishedVersion: number | null
  updatedAt: string
  user?: UserRef
}

export interface Sop extends SopSummary {
  steps: SopStepDef[]
  rules: SopRule[]
  hasUnpublishedChanges: boolean
  _count: { assignments: number; runbooks: number }
}

export interface PublishInfo {
  version: number
  publishedVersion: number | null
  problems: string[]
  versions: { id: string; version: number; createdAt: string; publishedBy: UserRef | null }[]
}

export interface SopMeta {
  stepTypes: { type: StepType; label: string; description: string; config?: string[] }[]
  operators: { operator: Operator; unary: boolean; arrayValue: boolean }[]
  fields: { path: string; label: string; kind: 'enum' | 'list' | 'text' | 'number' | 'custom' | 'step'; values?: string[]; subjects?: string[] }[]
  triggers: RuleTrigger[]
  actions: { type: ActionType; label: string; params: string[]; statuses?: string[] }[]
  notifyRecipients: string[]
  githubEvents: string[]
}

export type StepInput = Partial<Omit<SopStepDef, 'id' | 'sopId'>>
export type RuleInput = Omit<SopRule, 'id' | 'sopId'>

export const getSopMeta = () => request<SopMeta>('/api/sop-meta')

export const listSops = () => request<{ sops: SopSummary[] }>('/api/sops').then((d) => d.sops)
export const getSop = (id: string) => request<{ sop: Sop }>(`/api/sops/${id}`).then((d) => d.sop)
export const createSop = (title: string, content = '') =>
  request<{ sop: SopSummary }>('/api/sops', { method: 'POST', body: JSON.stringify({ title, content }) }).then((d) => d.sop)
export const updateSop = (id: string, body: { title?: string; content?: string }) =>
  request<{ sop: SopSummary }>(`/api/sops/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then((d) => d.sop)
export const deleteSop = (id: string) => request<unknown>(`/api/sops/${id}`, { method: 'DELETE' })

export const createStep = (sopId: string, body: StepInput) =>
  request<{ step: SopStepDef }>(`/api/sops/${sopId}/steps`, { method: 'POST', body: JSON.stringify(body) }).then((d) => d.step)
export const updateStep = (sopId: string, stepId: string, body: StepInput) =>
  request<{ step: SopStepDef }>(`/api/sops/${sopId}/steps/${stepId}`, { method: 'PATCH', body: JSON.stringify(body) }).then(
    (d) => d.step,
  )
export const deleteStep = (sopId: string, stepId: string) =>
  request<unknown>(`/api/sops/${sopId}/steps/${stepId}`, { method: 'DELETE' })

export const createRule = (sopId: string, body: RuleInput) =>
  request<{ rule: SopRule }>(`/api/sops/${sopId}/rules`, { method: 'POST', body: JSON.stringify(body) }).then((d) => d.rule)
export const updateRule = (sopId: string, ruleId: string, body: RuleInput) =>
  request<{ rule: SopRule }>(`/api/sops/${sopId}/rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(body) }).then(
    (d) => d.rule,
  )
export const deleteRule = (sopId: string, ruleId: string) =>
  request<unknown>(`/api/sops/${sopId}/rules/${ruleId}`, { method: 'DELETE' })

export const getPublishInfo = (sopId: string) => request<PublishInfo>(`/api/sops/${sopId}/publish`)
export const publishSop = (sopId: string) => request<unknown>(`/api/sops/${sopId}/publish`, { method: 'POST' })

// ---------------------------------------------------------------------------
// Assignments (entity defaults)
// ---------------------------------------------------------------------------

export type ScopeType = 'NOTE' | 'COMPONENT' | 'PROJECT'

export interface SopAssignment {
  id: string
  sopId: string
  noteId: string | null
  componentId: string | null
  projectId: string | null
  condition: Condition | null
  priority: number
  sop: { id: string; title: string; version: number; publishedVersion: number | null }
}

export const listAssignments = (scope: ScopeType, id: string) =>
  request<{ assignments: SopAssignment[] }>(`/api/sop-assignments?scope=${scope}&id=${encodeURIComponent(id)}`).then(
    (d) => d.assignments,
  )
export const createAssignment = (body: { sopId: string; scope: { type: ScopeType; id: string }; condition: Condition | null; priority: number }) =>
  request<{ assignment: SopAssignment }>('/api/sop-assignments', { method: 'POST', body: JSON.stringify(body) }).then(
    (d) => d.assignment,
  )
export const updateAssignment = (id: string, body: { sopId?: string; condition?: Condition | null; priority?: number }) =>
  request<{ assignment: SopAssignment }>(`/api/sop-assignments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(
    (d) => d.assignment,
  )
export const deleteAssignment = (id: string) => request<unknown>(`/api/sop-assignments/${id}`, { method: 'DELETE' })
export const applyAssignment = (id: string) =>
  request<{ checked: number; changed: number; failed: number }>(`/api/sop-assignments/${id}/apply`, { method: 'POST' })

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------

export type ExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'BLOCKED'
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'SKIPPED' | 'FAILED' | 'BLOCKED'
export type AssignmentType = 'ENTITY_INHERITED' | 'TASK_OVERRIDE' | 'MANUAL'

export type AssignmentSource =
  | { kind: 'OVERRIDE' }
  | { kind: 'ASSIGNMENT'; assignmentId: string; scopeType: ScopeType; scopeId: string; scopeName: string }

export interface ExecutionStep {
  id: string
  key: string | null
  position: number
  title: string
  description: string
  command: string | null
  requiresSignoff: boolean
  type: StepType
  config: StepConfig
  condition: Condition | null
  status: StepStatus
  notes: string
  output: string
  executor: string | null
  result: string | null
  data: { checklist?: Record<string, { done: boolean; by: string; at: string }> }
  callbackToken: string | null
  startedAt: string | null
  completedAt: string | null
  completedBy: UserRef | null
  approvals: { id: string; userId: string; decision: 'APPROVED' | 'REJECTED'; comment: string; createdAt: string; user: UserRef }[]
}

export interface ExecutionEvent {
  id: string
  type: string
  data: Record<string, unknown>
  createdAt: string
  actor: UserRef | null
}

export interface Execution {
  id: string
  title: string
  sopId: string | null
  sopVersion: number
  status: ExecutionStatus
  mode: 'MANUAL' | 'AUTOMATED'
  currentStepId: string | null
  assignmentType: AssignmentType | null
  assignment: { type: AssignmentType; source: AssignmentSource | null }
  updateAvailable: boolean
  createdAt: string
  completedAt: string | null
  steps: ExecutionStep[]
  events: ExecutionEvent[]
  progress: { completed: number; total: number; percent: number; currentStepId: string | null }
  sop: { id: string; title: string; version: number; publishedVersion: number | null } | null
}

export interface Resolution {
  sopId: string
  assignmentType: 'ENTITY_INHERITED' | 'TASK_OVERRIDE'
  source: AssignmentSource
  sop: { id: string; title: string } | null
}

export interface StepPatch {
  status?: StepStatus
  notes?: string
  output?: string
  executor?: string | null
  result?: 'PASSED' | 'FAILED'
  checklist?: Record<string, boolean>
}

export const listNoteExecutions = (noteId: string) =>
  request<{ executions: Execution[]; resolution: Resolution | null }>(`/api/notes/${noteId}/sop-executions`)
export const runSopOnNote = (noteId: string, sopId: string) =>
  request<{ execution: Execution }>(`/api/notes/${noteId}/sop-executions`, {
    method: 'POST',
    body: JSON.stringify({ sopId }),
  }).then((d) => d.execution)

export const patchExecution = (id: string, body: { action?: 'CANCEL' | 'RESTART'; mode?: 'MANUAL' | 'AUTOMATED' }) =>
  request<{ execution: Execution }>(`/api/sop-executions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(
    (d) => d.execution,
  )
export const deleteExecution = (id: string) => request<unknown>(`/api/sop-executions/${id}`, { method: 'DELETE' })
export const patchExecutionStep = (id: string, stepId: string, body: StepPatch) =>
  request<{ execution: Execution }>(`/api/sop-executions/${id}/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }).then((d) => d.execution)
export const decideApproval = (id: string, stepId: string, decision: 'APPROVED' | 'REJECTED', comment = '') =>
  request<{ execution: Execution }>(`/api/sop-executions/${id}/steps/${stepId}/approvals`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
  }).then((d) => d.execution)
