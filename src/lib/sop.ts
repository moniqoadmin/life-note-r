import type {
  Condition,
  ExecutionStatus,
  Operator,
  RuleTrigger,
  RunEvent,
  RunStep,
  SopActionType,
  SopStepType,
  StepStatus,
} from '../api/sops'

export const STEP_TYPE_LABEL: Record<SopStepType, string> = {
  INSTRUCTION: 'Instruction',
  CHECKLIST: 'Checklist',
  USER_ACTION: 'User action',
  APPROVAL: 'Approval',
  TESTING: 'Testing',
  GITHUB_ACTION: 'GitHub',
  CONDITION: 'Condition',
  CONFIRMATION: 'Confirmation',
  AUTOMATED_ACTION: 'Automated',
}

export const STEP_TYPE_ICON: Record<SopStepType, string> = {
  INSTRUCTION: '📄',
  CHECKLIST: '☑',
  USER_ACTION: '✋',
  APPROVAL: '✔',
  TESTING: '🧪',
  GITHUB_ACTION: '⑂',
  CONDITION: '◇',
  CONFIRMATION: '✎',
  AUTOMATED_ACTION: '⚙',
}

export const STEP_TYPE_HINT: Record<SopStepType, string> = {
  INSTRUCTION: 'Read and mark done.',
  CHECKLIST: 'Every required item must be ticked.',
  USER_ACTION: 'Someone does something, then marks it done.',
  APPROVAL: 'Needs N approvals; one rejection fails it.',
  TESTING: 'Recorded as Passed or Failed.',
  GITHUB_ACTION: 'Completes from a GitHub webhook (PR opened / merged / checks passed).',
  CONDITION: 'Evaluated automatically; branches the flow.',
  CONFIRMATION: 'An explicit confirmation by a person.',
  AUTOMATED_ACTION: 'Runs actions automatically (labels, status, …).',
}

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  VERIFIED: 'Completed',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
  SKIPPED: 'Skipped',
}

export const EXECUTION_STATUS_LABEL: Record<ExecutionStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  SKIPPED: 'Cancelled',
  BLOCKED: 'Blocked',
}

export const OPERATOR_LABEL: Record<Operator, string> = {
  EQUALS: '=',
  NOT_EQUALS: '≠',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'does not contain',
  IN: 'is one of',
  NOT_IN: 'is not one of',
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUAL: '≥',
  LESS_THAN: '<',
  LESS_THAN_OR_EQUAL: '≤',
  STARTS_WITH: 'starts with',
  ENDS_WITH: 'ends with',
  EXISTS: 'is set',
  NOT_EXISTS: 'is not set',
}

export const ACTION_LABEL: Record<SopActionType, string> = {
  GO_TO_STEP: 'Go to step',
  SKIP_STEP: 'Skip step',
  REQUIRE_APPROVALS: 'Require approvals',
  SET_STEP_CONFIG: 'Change step config',
  SET_RUNBOOK_STATUS: 'Set run status',
  SET_ISSUE_STATUS: 'Set issue status',
  SET_TASK_STATUS: 'Set task status',
  ADD_LABEL: 'Add issue label',
  REMOVE_LABEL: 'Remove issue label',
  ASSIGN_ISSUE: 'Assign issue',
  SET_ISSUE_FIELD: 'Set issue field',
}

/** Field paths offered by the condition editor; any `root.path` is accepted. */
export function conditionFieldSuggestions(stepKeys: string[]) {
  return [
    'note.title',
    'note.path',
    'note.depth',
    'note.module.title',
    'issue.type',
    'issue.priority',
    'issue.status',
    'issue.labels',
    'issue.component.name',
    'issue.fields.riskLevel',
    'event.step.key',
    'event.step.result',
    'execution.assignmentType',
    ...stepKeys.flatMap((k) => [`steps.${k}.status`, `steps.${k}.result`, `steps.${k}.approvals`]),
  ]
}

const showValue = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? `"${v}"` : String(v))

/** One-line, human-readable form of a condition tree. */
export function describeCondition(c: Condition | null | undefined): string {
  if (!c) return 'Always'
  if ('all' in c) return c.all.map(describeCondition).join(' AND ')
  if ('any' in c) return `(${c.any.map(describeCondition).join(' OR ')})`
  if ('not' in c) return `NOT (${describeCondition(c.not)})`
  const op = OPERATOR_LABEL[c.operator] ?? c.operator
  return c.operator === 'EXISTS' || c.operator === 'NOT_EXISTS' ? `${c.field} ${op}` : `${c.field} ${op} ${showValue(c.value)}`
}

export const isFinished = (s: StepStatus) => s === 'VERIFIED' || s === 'SKIPPED'

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const who = (e: RunEvent) => e.actor?.name ?? e.actor?.email ?? 'System'

/** Audit-trail sentence for one execution event. */
export function describeEvent(e: RunEvent, steps: Map<string, RunStep>): string {
  const d = e.data
  const step: RunStep | undefined =
    [...steps.values()].find((s) => s.key === d.stepKey) ?? (d.stepId ? steps.get(String(d.stepId)) : undefined)
  const name = step ? `“${step.title}”` : d.title ? `“${String(d.title)}”` : 'step'
  const attempt = typeof d.attempt === 'number' && d.attempt > 1 ? ` (attempt ${d.attempt})` : ''
  const result = d.result && d.result !== 'FAILED' ? ` — ${String(d.result)}` : ''
  const notes = d.notes ? `: “${String(d.notes)}”` : ''
  switch (e.type) {
    case 'EXECUTION_CREATED':
      return `Run started from SOP v${d.sopVersion ?? '?'} (${String(d.assignmentType ?? 'MANUAL').toLowerCase().replace('_', ' ')})`
    case 'ASSIGNMENT_RESOLVED':
      return 'SOP inherited from parent'
    case 'STEP_STARTED':
      return `${name} started${attempt}`
    case 'STEP_COMPLETED':
      return `${name} completed by ${d.executor ? String(d.executor) : who(e)}${result}${notes}`
    case 'STEP_FAILED':
      return `${name} failed${result} — ${who(e)}${notes}`
    case 'STEP_BLOCKED':
      return `${name} blocked — ${who(e)}${notes}`
    case 'STEP_SKIPPED':
      return `${name} skipped${d.reason === 'CONDITION_FALSE' ? ' (condition not met)' : d.reason === 'RULE' ? ' by a rule' : ` by ${who(e)}`}`
    case 'STEP_RETRIED':
      return `${name} retried${attempt} by ${who(e)}`
    case 'APPROVAL_RECEIVED':
      return `${who(e)} ${d.decision === 'APPROVED' ? 'approved' : 'rejected'} ${name} (${d.approvals}/${d.required})${d.comment ? `: ${String(d.comment)}` : ''}`
    case 'RULE_EXECUTED':
      return `Rule “${String(d.name)}” fired on ${String(d.trigger)}`
    case 'ACTION_FAILED':
      return `Action failed: ${String(d.error)}`
    case 'EXECUTION_JUMPED':
      return `Moved ${d.direction === 'FORWARD' ? 'forward' : 'back'} to “${String(d.to)}”`
    case 'EXTERNAL_EVENT':
      return `GitHub: ${String(d.type)}${d.baseBranch ? ` → ${String(d.baseBranch)}` : ''}`
    case 'EXECUTION_COMPLETED':
      return 'Run completed'
    case 'EXECUTION_CANCELLED':
      return `Run cancelled${d.reason === 'REASSIGNED' ? ' (SOP changed)' : ''}`
    case 'ASSIGNMENT_CHANGED':
      return 'Assignment changed'
    case 'LOOP_LIMIT':
      return 'Stopped: too many automatic transitions (check rules for loops)'
    default:
      return e.type
  }
}

export const RULE_TRIGGER_LABEL: Record<RuleTrigger, string> = {
  EXECUTION_STARTED: 'Run starts',
  EXECUTION_COMPLETED: 'Run completes',
  STEP_STARTED: 'A step starts',
  STEP_COMPLETED: 'A step completes',
  STEP_FAILED: 'A step fails',
  STEP_BLOCKED: 'A step is blocked',
  STEP_SKIPPED: 'A step is skipped',
  NOTE_UPDATED: 'The ticket is edited',
  ISSUE_UPDATED: 'The issue is edited',
  ISSUE_STATUS_CHANGED: 'The issue status changes',
  TASK_UPDATED: 'The task is edited',
}
