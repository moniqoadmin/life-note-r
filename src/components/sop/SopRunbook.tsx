import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BASE_URL } from '../../api/baseUrl'
import {
  decideApproval,
  patchExecution,
  patchExecutionStep,
  runSopOnNote,
  type Execution,
  type ExecutionEvent,
  type ExecutionStep,
  type Resolution,
  type StepPatch,
} from '../../api/sops'
import { useConfirm } from '../../hooks/useConfirm'
import { sopKeys, useNoteExecutions, useSopList, useSopMeta } from '../../hooks/useSops'
import { describeCondition } from '../../lib/sopConditions'
import { sourceLabel } from '../../lib/sopUi'
import './sop.css'

const STEP_STATE: Record<ExecutionStep['status'], string> = {
  VERIFIED: 'Done',
  IN_PROGRESS: 'Active',
  PENDING: 'Pending',
  SKIPPED: 'Skipped',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
}

const RUN_STATE: Record<Execution['status'], string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'Active runbook',
  COMPLETED: 'Runbook complete',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
  SKIPPED: 'Cancelled',
}

const TYPE_LABEL: Record<ExecutionStep['type'], string> = {
  INSTRUCTION: 'Instruction',
  CHECKLIST: 'Checklist',
  USER_ACTION: 'Action',
  APPROVAL: 'Approval',
  TESTING: 'Testing',
  GITHUB_ACTION: 'GitHub',
  CONDITION: 'Condition',
  CONFIRMATION: 'Confirmation',
  AUTOMATED_ACTION: 'Automated',
}

const who = (u: { name: string | null; email: string } | null | undefined) => (u ? (u.name ?? u.email) : 'automation')
const clock = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Live SOP runbook for a note: every execution of the note (active first, finished /
 * cancelled ones under History), with per-step-type controls driven by the engine.
 */
export function SopRunbook({ noteId, onSubjectChanged }: { noteId: string; onSubjectChanged: () => void }) {
  const { data, error, isPending } = useNoteExecutions(noteId)
  const queryClient = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: sopKeys.noteExecutions(noteId) })
    // SOP actions can change the note itself (status, labels, fields).
    onSubjectChanged()
  }

  if (isPending) return <div className="sop card muted small">Loading SOP…</div>
  if (error) return <div className="sop card error small">{(error as Error).message}</div>

  const executions = data?.executions ?? []
  const live = executions.filter((e) => e.status !== 'SKIPPED' && e.status !== 'COMPLETED')
  const latestDone = [...executions].reverse().find((e) => e.status === 'COMPLETED')
  const shown = live.length ? live : latestDone ? [latestDone] : []
  const history = executions.filter((e) => !shown.includes(e)).reverse()

  return (
    <div className="sop-stack">
      {shown.map((execution) => (
        <ExecutionCard key={execution.id} execution={execution} onChanged={refresh} />
      ))}
      {shown.length === 0 && <NoRunbook noteId={noteId} resolution={data?.resolution ?? null} onStarted={refresh} />}
      {shown.length > 0 && <RunAnother noteId={noteId} onStarted={refresh} />}
      {history.length > 0 && (
        <div className="sop-history">
          <button type="button" className="text-btn sm" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? '▾' : '▸'} History ({history.length})
          </button>
          {showHistory &&
            history.map((e) => (
              <div key={e.id} className="sop-history-row small">
                <span className={`run-pill run-${e.status.toLowerCase()}`}>{RUN_STATE[e.status]}</span>
                <span>
                  {e.title} · v{e.sopVersion}
                </span>
                <span className="muted">
                  {sourceLabel(e.assignment)} · {clock(e.createdAt)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function NoRunbook({ noteId, resolution, onStarted }: { noteId: string; resolution: Resolution | null; onStarted: () => void }) {
  return (
    <div className="sop card sop-empty">
      <div>
        <strong>No SOP running</strong>
        <p className="muted small">
          {resolution
            ? `This ticket resolves to “${resolution.sop?.title}” (${sourceLabel(resolution).toLowerCase()}).`
            : 'Nothing is assigned here. Pick an SOP to run, pin one in the sidebar, or set a default on the parent module.'}
        </p>
      </div>
      <RunAnother noteId={noteId} onStarted={onStarted} label="Run an SOP" />
    </div>
  )
}

function RunAnother({ noteId, onStarted, label = '+ Run another SOP' }: { noteId: string; onStarted: () => void; label?: string }) {
  const { data: sops } = useSopList()
  const [open, setOpen] = useState(false)
  const [sopId, setSopId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <button type="button" className="text-btn sm sop-run-another" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }
  return (
    <div className="sop-run-form">
      <select className="sop-select sm" value={sopId} onChange={(e) => setSopId(e.target.value)}>
        <option value="">Choose an SOP…</option>
        {sops?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
            {s.publishedVersion ? ` (v${s.publishedVersion})` : ' (draft)'}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="primary-btn sm"
        disabled={!sopId || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await runSopOnNote(noteId, sopId)
            setOpen(false)
            setSopId('')
            onStarted()
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        Start
      </button>
      <button type="button" className="text-btn sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="error small">{error}</span>}
    </div>
  )
}

function ExecutionCard({ execution, onChanged }: { execution: Execution; onChanged: () => void }) {
  const [tab, setTab] = useState<'steps' | 'audit'>('steps')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()
  const { completed, total, percent } = execution.progress
  const active = execution.steps.find((s) => s.id === execution.currentStepId)
  const latest = execution.sop ? (execution.sop.publishedVersion ?? execution.sop.version) : null

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const stepAction = (step: ExecutionStep) => ({
    patch: (body: StepPatch) => run(() => patchExecutionStep(execution.id, step.id, body)),
    decide: (decision: 'APPROVED' | 'REJECTED', comment: string) => run(() => decideApproval(execution.id, step.id, decision, comment)),
  })

  return (
    <div className={`sop card run-${execution.status.toLowerCase()}`}>
      <div className="sop-head">
        <div className="sop-title-row">
          <span className="sop-code">
            📘 {execution.title} · v{execution.sopVersion}
          </span>
          <span className="source-chip">{sourceLabel(execution.assignment)}</span>
          {execution.updateAvailable && latest && (
            <span className="source-chip warn" title="This run keeps the version it started with">
              v{latest} available
            </span>
          )}
        </div>
        <span className={`run-pill run-${execution.status.toLowerCase()}`}>
          ● {RUN_STATE[execution.status]} · {completed} of {total} steps ({percent}%)
        </span>
        <div className="sop-tabs">
          <button type="button" className={tab === 'steps' ? 'on' : ''} onClick={() => setTab('steps')}>
            ☑ Steps
          </button>
          <button type="button" className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>
            ⧉ Audit trail ({execution.events.length})
          </button>
          <span className="sop-tabs-spacer" />
          <button
            type="button"
            className="ghost-icon"
            title="Restart from the first step"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: 'Restart this runbook?',
                message: 'Every step goes back to pending and approvals are cleared. The audit trail is kept.',
                confirmLabel: 'Restart',
                tone: 'danger',
              })
              if (ok) run(() => patchExecution(execution.id, { action: 'RESTART' }))
            }}
          >
            ↺
          </button>
          {execution.status !== 'COMPLETED' && (
            <button
              type="button"
              className="ghost-icon"
              title="Cancel this runbook"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Cancel this runbook?',
                  message: 'It stops here and moves to the history. You can start the SOP again later.',
                  confirmLabel: 'Cancel runbook',
                  cancelLabel: 'Keep running',
                  tone: 'danger',
                })
                if (ok) run(() => patchExecution(execution.id, { action: 'CANCEL' }))
              }}
            >
              ⏹
            </button>
          )}
        </div>
      </div>

      <div className="progress sop-progress">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="sop-progress-meta muted small">
        <span>{completed} completed</span>
        <span>{active ? `Step ${active.position + 1}: ${active.title}` : execution.status === 'COMPLETED' ? 'All steps finished' : '—'}</span>
        <span>{total - completed} remaining</span>
      </div>
      {error && <p className="error small sop-error">{error}</p>}

      {tab === 'audit' ? (
        <AuditTrail execution={execution} />
      ) : (
        <ol className="sop-steps">
          {execution.steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              isActive={step.id === execution.currentStepId}
              executionStatus={execution.status}
              busy={busy}
              actions={stepAction(step)}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function StepRow({
  step,
  isActive,
  executionStatus,
  busy,
  actions,
}: {
  step: ExecutionStep
  isActive: boolean
  executionStatus: Execution['status']
  busy: boolean
  actions: { patch: (body: StepPatch) => void; decide: (d: 'APPROVED' | 'REJECTED', comment: string) => void }
}) {
  const { data: meta } = useSopMeta()
  const confirm = useConfirm()
  const finished = step.status === 'VERIFIED' || step.status === 'SKIPPED' || step.status === 'FAILED'
  const canReopen = finished && !isActive && executionStatus !== 'SKIPPED'
  const marker =
    step.status === 'VERIFIED' ? '✓' : step.status === 'SKIPPED' ? '⤼' : step.status === 'FAILED' ? '✕' : step.status === 'BLOCKED' ? '⏸' : isActive ? '●' : '🔒'

  return (
    <li className={`sop-step sop-${step.status.toLowerCase()}${isActive ? ' is-active' : ''}`}>
      <span className="sop-marker">{marker}</span>
      <div className="sop-step-body">
        <div className="sop-step-head">
          <span className="sop-step-title">
            {step.position + 1}. {step.title}
            {isActive && step.status === 'IN_PROGRESS' && <span className="sop-live" />}
          </span>
          <span className="sop-step-tags">
            <span className="type-chip">{TYPE_LABEL[step.type]}</span>
            <span className="sop-state">{STEP_STATE[step.status]}</span>
            {canReopen && (
              <button
                type="button"
                className="text-btn xs"
                title="Rewind the runbook to this step (later steps reset)"
                disabled={busy}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Reopen step ${step.position + 1}?`,
                    message: `“${step.title}” becomes the active step again and every later step is reset.`,
                    confirmLabel: 'Reopen',
                    tone: 'danger',
                  })
                  if (ok) actions.patch({ status: 'IN_PROGRESS' })
                }}
              >
                ↺ Reopen
              </button>
            )}
          </span>
        </div>
        {step.condition && (
          <p className="sop-meta muted">Only when {describeCondition(step.condition, meta)}</p>
        )}
        {step.completedAt && step.status !== 'PENDING' && (
          <p className="sop-meta muted">
            {step.status === 'SKIPPED' && step.executor === 'condition'
              ? 'Skipped — condition not met'
              : `${STEP_STATE[step.status]} by ${step.executor && !step.completedBy ? step.executor : who(step.completedBy)} · ${clock(step.completedAt)}`}
            {step.result && step.type !== 'CONDITION' && ` · ${step.result}`}
          </p>
        )}
        {step.description && (isActive || step.status === 'PENDING') && <p className="sop-desc">{step.description}</p>}
        {step.command && (
          <div className="sop-cmd">
            <code>{step.command}</code>
          </div>
        )}
        {step.output && step.status !== 'IN_PROGRESS' && <pre className="sop-output">{step.output}</pre>}
        {step.notes && step.status !== 'IN_PROGRESS' && <p className="sop-meta">📝 {step.notes}</p>}
        {step.type === 'APPROVAL' && step.approvals.length > 0 && (
          <ul className="approvals small">
            {step.approvals.map((a) => (
              <li key={a.id}>
                {a.decision === 'APPROVED' ? '✅' : '⛔'} {who(a.user)}
                {a.comment && <span className="muted"> — {a.comment}</span>}
              </li>
            ))}
          </ul>
        )}
        {isActive && executionStatus !== 'SKIPPED' && <StepControls step={step} busy={busy} actions={actions} />}
      </div>
    </li>
  )
}

function StepControls({
  step,
  busy,
  actions,
}: {
  step: ExecutionStep
  busy: boolean
  actions: { patch: (body: StepPatch) => void; decide: (d: 'APPROVED' | 'REJECTED', comment: string) => void }
}) {
  const [notes, setNotes] = useState(step.notes)
  const [comment, setComment] = useState('')
  const [copied, setCopied] = useState(false)
  const config = step.config ?? {}

  if (step.status === 'FAILED' || step.status === 'BLOCKED') {
    return (
      <div className="step-controls">
        <span className="muted small">{step.status === 'FAILED' ? 'This step failed.' : 'This step is blocked.'}</span>
        <button type="button" className="primary-btn sm" disabled={busy} onClick={() => actions.patch({ status: 'IN_PROGRESS' })}>
          ↻ Retry
        </button>
        {!config.mandatory && (
          <button type="button" className="text-btn sm" disabled={busy} onClick={() => actions.patch({ status: 'SKIPPED' })}>
            Skip
          </button>
        )}
      </div>
    )
  }

  const notesField = step.requiresSignoff && (
    <input
      className="inline-input"
      value={notes}
      maxLength={10_000}
      placeholder="Sign-off notes (required) — links, evidence…"
      onChange={(e) => setNotes(e.target.value)}
    />
  )
  const withNotes = (body: StepPatch): StepPatch => (step.requiresSignoff || notes !== step.notes ? { ...body, notes } : body)
  const secondary = (
    <>
      <button type="button" className="text-btn sm" disabled={busy} onClick={() => actions.patch(withNotes({ status: 'BLOCKED' }))}>
        Block
      </button>
      <button type="button" className="text-btn sm danger" disabled={busy} onClick={() => actions.patch(withNotes({ status: 'FAILED' }))}>
        Fail
      </button>
      {!config.mandatory && (
        <button type="button" className="text-btn sm" disabled={busy} onClick={() => actions.patch(withNotes({ status: 'SKIPPED' }))}>
          Skip
        </button>
      )}
    </>
  )

  switch (step.type) {
    case 'APPROVAL': {
      const approved = step.approvals.filter((a) => a.decision === 'APPROVED').length
      const required = config.requiredApprovals ?? 1
      return (
        <div className="step-controls column">
          <span className="small">
            <strong>
              {approved} / {required}
            </strong>{' '}
            approvals
            {config.approverRoles?.length ? ` · ${config.approverRoles.join(' / ').toLowerCase()} only` : ''}
            {config.preventSelfApproval ? ' · not by whoever did the work' : ''}
          </span>
          <div className="step-controls">
            <input
              className="inline-input"
              value={comment}
              placeholder="Comment (optional)"
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="button" className="primary-btn sm" disabled={busy} onClick={() => actions.decide('APPROVED', comment)}>
              Approve
            </button>
            <button type="button" className="text-btn sm danger" disabled={busy} onClick={() => actions.decide('REJECTED', comment)}>
              Reject
            </button>
          </div>
        </div>
      )
    }
    case 'CHECKLIST': {
      const state = step.data?.checklist ?? {}
      const items = config.items ?? []
      const ready = items.every((i) => i.required === false || state[i.key]?.done)
      return (
        <div className="step-controls column">
          <div className="checklist">
            {items.map((item) => (
              <label key={item.key} className={`check-row${state[item.key]?.done ? ' done' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!state[item.key]?.done}
                  disabled={busy}
                  onChange={(e) => actions.patch({ checklist: { [item.key]: e.target.checked } })}
                />
                <span>
                  {item.label}
                  {item.required === false && <span className="muted small"> (optional)</span>}
                </span>
              </label>
            ))}
          </div>
          {notesField}
          <div className="step-controls">
            <button type="button" className="primary-btn sm" disabled={busy || !ready} onClick={() => actions.patch(withNotes({ status: 'VERIFIED' }))}>
              Complete checklist
            </button>
            {secondary}
          </div>
        </div>
      )
    }
    case 'TESTING':
      return (
        <div className="step-controls column">
          {notesField ?? (
            <input className="inline-input" value={notes} placeholder="Test notes / report link" onChange={(e) => setNotes(e.target.value)} />
          )}
          <div className="step-controls">
            <button type="button" className="primary-btn sm pass" disabled={busy} onClick={() => actions.patch({ result: 'PASSED', notes })}>
              ✓ Passed
            </button>
            <button type="button" className="primary-btn sm fail" disabled={busy} onClick={() => actions.patch({ result: 'FAILED', notes })}>
              ✕ Failed
            </button>
            {config.requireResult === false && (
              <button type="button" className="text-btn sm" disabled={busy} onClick={() => actions.patch(withNotes({ status: 'VERIFIED' }))}>
                Done without result
              </button>
            )}
          </div>
        </div>
      )
    case 'CONDITION':
      return <p className="muted small">Evaluated automatically.</p>
    case 'GITHUB_ACTION':
    case 'AUTOMATED_ACTION': {
      const url = step.callbackToken ? `${BASE_URL}/api/sop-executions/callbacks/${step.callbackToken}` : null
      const curl = url && `curl -X POST ${url} -H 'Content-Type: application/json' -d '{"status":"SUCCESS"}'`
      return (
        <div className="step-controls column">
          <span className="muted small">
            {step.type === 'GITHUB_ACTION' && config.event
              ? `Waiting for GitHub: ${config.event}${config.branch ? ` on ${config.branch}` : ''}${config.repository ? ` in ${config.repository}` : ''}.`
              : 'Waiting for an external system to report back.'}{' '}
            CI can finish it with:
          </span>
          {curl && (
            <div className="sop-cmd">
              <code>{curl}</code>
              <button
                type="button"
                className="text-btn xs"
                onClick={() =>
                  navigator.clipboard?.writeText(curl).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
          <div className="step-controls">
            <button
              type="button"
              className="pill-btn sm"
              disabled={busy}
              onClick={() => actions.patch({ status: 'VERIFIED', executor: 'manual override', notes })}
            >
              Mark done manually
            </button>
            {secondary}
          </div>
        </div>
      )
    }
    default:
      return (
        <div className="step-controls column">
          {step.type === 'CONFIRMATION' && config.confirmationText && <p className="sop-confirm">{config.confirmationText}</p>}
          {notesField}
          <div className="step-controls">
            <button type="button" className="primary-btn sm" disabled={busy} onClick={() => actions.patch(withNotes({ status: 'VERIFIED' }))}>
              {step.type === 'CONFIRMATION' ? 'Confirm' : 'Mark done'}
            </button>
            {secondary}
          </div>
        </div>
      )
  }
}

function describeEvent(event: ExecutionEvent, execution: Execution): string {
  const d = event.data as Record<string, string | number | undefined | unknown[]>
  const title = d.title ? `“${d.title}”` : ''
  const actor = event.actor ? who(event.actor) : null
  const by = actor ? ` by ${actor}` : ''
  switch (event.type) {
    case 'EXECUTION_CREATED':
      return `Started v${d.sopVersion}${d.published ? '' : ' (draft)'} — ${sourceLabel({ type: (d.assignmentType as Execution['assignment']['type']) ?? 'MANUAL', source: (d.source as never) ?? null })}`
    case 'STEP_STARTED':
      return `Step ${title} started`
    case 'STEP_COMPLETED':
      return `Step ${title} completed${d.executor ? ` (${d.executor})` : by}`
    case 'STEP_SKIPPED':
      return `Step ${title} skipped${d.reason === 'CONDITION_FALSE' ? ' — condition not met' : d.reason === 'RULE' ? ' by a rule' : by}`
    case 'STEP_FAILED':
      return `Step ${title} failed${by}${d.notes ? `: ${d.notes}` : ''}`
    case 'STEP_BLOCKED':
      return `Step ${title} blocked${by}${d.reason ? `: ${d.reason}` : ''}`
    case 'STEP_RETRIED':
      return `Step ${title} retried${by}`
    case 'CHECKLIST_UPDATED':
      return `Checklist updated${by}`
    case 'APPROVAL_RECEIVED':
      return `${actor ?? 'Someone'} ${d.decision === 'APPROVED' ? 'approved' : 'rejected'}${d.comment ? `: ${d.comment}` : ''}`
    case 'APPROVAL_PENDING':
      return `${d.approvals} of ${d.required} approvals`
    case 'RULE_EXECUTED':
      return `Rule “${d.name}” fired on ${String(d.trigger).toLowerCase().replace(/_/g, ' ')}`
    case 'ACTION_EXECUTED':
      return `→ ${String(d.type).toLowerCase().replace(/_/g, ' ')}${d.stepKey ? ` ${d.stepKey}` : d.status ? ` ${d.status}` : d.label ? ` “${d.label}”` : ''}`
    case 'ACTION_IGNORED':
      return `Action ${d.type} skipped: ${d.reason}`
    case 'EXECUTION_REWOUND':
      return `Rewound to ${title}${d.reason === 'RULE' ? ' by a rule' : by}`
    case 'EXECUTION_COMPLETED':
      return 'Runbook completed'
    case 'EXECUTION_CANCELLED':
      return `Cancelled${d.reason === 'SOP_REASSIGNED' ? ' — the ticket now runs a different SOP' : d.reason === 'SOP_UNASSIGNED' ? ' — no SOP applies any more' : by}`
    case 'EXECUTION_BLOCKED':
      return String(d.message ?? 'Blocked')
    case 'ASSIGNMENT_CHANGED':
      return `Assignment changed to ${String(d.assignmentType).toLowerCase().replace('_', ' ')}`
    case 'RULES_SKIPPED':
      return 'Rules stopped: too many nested rule runs'
    case 'GOTO_TARGET_MISSING':
      return `Jump target “${d.key}” doesn't exist in v${execution.sopVersion}`
    default:
      return event.type
  }
}

function AuditTrail({ execution }: { execution: Execution }) {
  return (
    <ol className="sop-audit">
      {[...execution.events].reverse().map((e) => (
        <li key={e.id} className={`ev-${e.type.toLowerCase()}`}>
          <span className="sop-audit-at">{clock(e.createdAt)}</span>
          <span>{describeEvent(e, execution)}</span>
        </li>
      ))}
    </ol>
  )
}
