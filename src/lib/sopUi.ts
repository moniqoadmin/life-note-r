import type { Execution, Resolution, RuleInput, RuleTrigger, SopAction, StepConfig, StepType } from '../api/sops'

// Non-component helpers shared by the SOP components (kept out of .tsx files so
// React fast refresh keeps working).

export const defaultAction = (steps: { key: string }[]): SopAction =>
  steps.length ? { type: 'GOTO_STEP', stepKey: steps[0]!.key } : { type: 'SET_SUBJECT_STATUS', status: 'IN_PROGRESS' }

/** Sensible starting config when a step's type changes (keeps the shared keys). */
export function defaultConfig(type: StepType, previous: StepConfig = {}): StepConfig {
  const shared: StepConfig = { ...(previous.mandatory && { mandatory: true }), ...(previous.overrides && { overrides: previous.overrides }) }
  switch (type) {
    case 'CHECKLIST':
      return { ...shared, items: previous.items?.length ? previous.items : [{ key: 'item_1', label: 'First item', required: true }] }
    case 'APPROVAL':
      return { ...shared, requiredApprovals: previous.requiredApprovals ?? 1 }
    case 'TESTING':
      return { ...shared, requireResult: true }
    case 'CONDITION':
      return { ...shared, check: previous.check ?? { field: 'issue.status', operator: 'EQUALS', value: 'IN_PROGRESS' }, onFalse: 'FAIL' }
    case 'AUTOMATED_ACTION':
      return { ...shared, action: { type: 'SET_SUBJECT_STATUS', status: 'IN_REVIEW' } }
    case 'GITHUB_ACTION':
      return { ...shared, event: 'pull_request.merged' }
    default:
      return shared
  }
}

const TRIGGER_LABEL: Record<RuleTrigger, string> = {
  EXECUTION_STARTED: 'Runbook starts',
  STEP_STARTED: 'A step starts',
  STEP_COMPLETED: 'A step completes',
  STEP_FAILED: 'A step fails',
  STEP_SKIPPED: 'A step is skipped',
  STEP_BLOCKED: 'A step is blocked',
  EXECUTION_COMPLETED: 'Runbook completes',
  SUBJECT_STATUS_CHANGED: 'Ticket status changes',
  SUBJECT_UPDATED: 'Ticket fields change',
}

export const triggerLabel = (t: string) => TRIGGER_LABEL[t as RuleTrigger] ?? t

export const newRule = (steps: { key: string }[]): RuleInput => ({
  name: '',
  trigger: 'STEP_FAILED',
  condition: steps.length ? { field: 'trigger.stepKey', operator: 'EQUALS', value: steps.at(-1)!.key } : null,
  actions: [defaultAction(steps)],
  enabled: true,
})

/** "Inherited from payment-service" / "Pinned to this ticket" / "Run manually". */
export function sourceLabel(assignment: Execution['assignment'] | Resolution) {
  const type = 'type' in assignment ? assignment.type : assignment.assignmentType
  const source = assignment.source
  if (type === 'TASK_OVERRIDE') return 'Pinned to this ticket'
  if (type === 'ENTITY_INHERITED') return source?.kind === 'ASSIGNMENT' ? `Inherited from ${source.scopeName || 'parent'}` : 'Inherited'
  return 'Run manually'
}
