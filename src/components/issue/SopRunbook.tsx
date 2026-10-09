import { useMemo, useState } from 'react'
import type { Execution, ExecutionStatus, RunStep, StepAction } from '../../api/sops'
import { useNoteExecutionActions, useNoteExecutions, useSops } from '../../hooks/useSops'
import {
  EXECUTION_STATUS_LABEL,
  STEP_STATUS_LABEL,
  STEP_TYPE_ICON,
  STEP_TYPE_LABEL,
  describeCondition,
  describeEvent,
  formatTime,
  isFinished,
} from '../../lib/sop'
import { LifeNoteLoader } from '../LifeNoteLoader'

const OPEN: ExecutionStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'FAILED']

const ASSIGNMENT_LABEL = {
  ENTITY_INHERITED: 'Inherited',
  TASK_OVERRIDE: 'Ticket SOP',
  MANUAL: 'Started manually',
} as const

const MARKER: Record<RunStep['status'], string> = {
  VERIFIED: '✓',
  SKIPPED: '⤼',
  FAILED: '✕',
  BLOCKED: '⏸',
  IN_PROGRESS: '',
  PENDING: '🔒',
}

const cfg = <T,>(step: RunStep, key: string, fallback: T): T => (step.config[key] as T | undefined) ?? fallback

interface StepHandlers {
  busy: boolean
  userId: string
  act: (body: StepAction) => void
  decide: (decision: 'APPROVED' | 'REJECTED', comment: string) => void
  rewind: () => void
}

/** Controls for the step the run is waiting on, by step type. */
function ActiveControls({ step, h }: { step: RunStep; h: StepHandlers }) {
  const [notes, setNotes] = useState('')
  const needsNotes = step.requiresSignoff && !notes.trim() && !step.notes.trim()
  const withNotes = (body: StepAction): StepAction => (notes.trim() ? { ...body, notes: notes.trim() } : body)

  const notesInput = (placeholder: string) => (
    <input
      className="inline-input"
      value={notes}
      maxLength={10_000}
      onChange={(e) => setNotes(e.target.value)}
      placeholder={step.requiresSignoff ? `${placeholder} (required)` : placeholder}
    />
  )

  if (step.type === 'APPROVAL') {
    const required = cfg(step, 'requiredApprovals', 1)
    const current = step.approvals.filter((a) => a.current)
    const mine = current.find((a) => a.userId === h.userId)
    const approved = current.filter((a) => a.decision === 'APPROVED').length
    return (
      <div className="sop-controls">
        <div className="sop-approvals">
          <span className="sop-approval-count">
            {approved} / {required} approval{required === 1 ? '' : 's'}
          </span>
          {current.map((a) => (
            <span key={a.id} className={`sop-approval ${a.decision === 'APPROVED' ? 'ok' : 'no'}`}>
              {a.decision === 'APPROVED' ? '✓' : '✕'} {a.user.name ?? a.user.email}
              {a.comment && <em> — {a.comment}</em>}
            </span>
          ))}
        </div>
        {mine ? (
          <p className="muted small">You {mine.decision === 'APPROVED' ? 'approved' : 'rejected'} this step.</p>
        ) : (
          <div className="sop-signoff">
            {notesInput('Comment')}
            <button type="button" className="primary-btn sm" disabled={h.busy} onClick={() => h.decide('APPROVED', notes.trim())}>
              Approve
            </button>
            <button type="button" className="danger-btn sm" disabled={h.busy} onClick={() => h.decide('REJECTED', notes.trim())}>
              Reject
            </button>
          </div>
        )}
      </div>
    )
  }

  if (step.type === 'CHECKLIST') {
    const items = cfg<{ id: string; label: string; required?: boolean }[]>(step, 'items', [])
    const checked = new Set(step.data.checkedItems ?? [])
    const missing = items.some((i) => i.required !== false && !checked.has(i.id))
    const toggle = (id: string) => {
      const next = new Set(checked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      h.act({ checkedItems: [...next] })
    }
    return (
      <div className="sop-controls">
        <div className="sop-checklist">
          {items.map((i) => (
            <label key={i.id} className={`check-row${checked.has(i.id) ? ' done' : ''}`}>
              <input type="checkbox" checked={checked.has(i.id)} disabled={h.busy} onChange={() => toggle(i.id)} />
              <span>
                {i.label}
                {i.required === false && <span className="muted"> (optional)</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="sop-signoff">
          {notesInput('Notes')}
          <button
            type="button"
            className="primary-btn sm"
            disabled={h.busy || missing || needsNotes}
            onClick={() => h.act(withNotes({ status: 'VERIFIED' }))}
          >
            Complete
          </button>
        </div>
      </div>
    )
  }

  if (step.type === 'TESTING') {
    return (
      <div className="sop-controls sop-signoff">
        {notesInput('Test notes / report link')}
        <button
          type="button"
          className="primary-btn sm"
          disabled={h.busy || needsNotes}
          onClick={() => h.act(withNotes({ result: 'PASSED' }))}
        >
          ✓ Passed
        </button>
        <button type="button" className="danger-btn sm" disabled={h.busy} onClick={() => h.act(withNotes({ result: 'FAILED' }))}>
          ✕ Failed
        </button>
      </div>
    )
  }

  if (step.type === 'GITHUB_ACTION') {
    const event = cfg<string>(step, 'event', 'PR_MERGED')
    const branch = cfg<string | undefined>(step, 'baseBranch', undefined)
    const what = event === 'PR_OPENED' ? 'a pull request to be opened' : event === 'CHECKS_PASSED' ? 'CI checks to pass' : 'the pull request to be merged'
    return (
      <div className="sop-controls">
        <p className="sop-waiting">
          ⑂ Waiting for {what}
          {branch && (
            <>
              {' '}
              into <code>{branch}</code>
            </>
          )}
          . Put the ticket key in the branch name or PR title.
        </p>
        {cfg(step, 'allowManualCompletion', true) && (
          <button type="button" className="pill-btn sm" disabled={h.busy} onClick={() => h.act({ status: 'VERIFIED' })}>
            Mark done manually
          </button>
        )}
      </div>
    )
  }

  const prompt = cfg<string | undefined>(step, 'prompt', undefined)
  return (
    <div className="sop-controls">
      {prompt && <p className="sop-desc">{prompt}</p>}
      <div className="sop-signoff">
        {notesInput(step.requiresSignoff ? 'Sign-off notes' : 'Notes')}
        <button
          type="button"
          className="primary-btn sm"
          disabled={h.busy || needsNotes}
          onClick={() => h.act(withNotes({ status: 'VERIFIED' }))}
        >
          {step.type === 'CONFIRMATION' ? 'Confirm' : 'Mark done'}
        </button>
      </div>
    </div>
  )
}

function StepRow({ step, index, h }: { step: RunStep; index: number; h: StepHandlers }) {
  const finished = isFinished(step.status)
  const by = step.completedBy?.name ?? step.completedBy?.email ?? step.executor
  return (
    <li className={`sop-step sop-${step.status.toLowerCase()}`}>
      <span className="sop-marker">{step.status === 'IN_PROGRESS' ? <span className="sop-live" /> : MARKER[step.status]}</span>
      <div className="sop-step-body">
        <div className="sop-step-head">
          <span className="sop-step-title">
            {index + 1}. {step.title}
            <span className="sop-type" title={STEP_TYPE_LABEL[step.type]}>
              {STEP_TYPE_ICON[step.type]} {STEP_TYPE_LABEL[step.type]}
            </span>
            {step.attempt > 1 && step.status !== 'PENDING' && <span className="sop-attempt">attempt {step.attempt}</span>}
          </span>
          <span className="sop-state">{STEP_STATUS_LABEL[step.status]}</span>
        </div>

        {(step.status === 'VERIFIED' || step.status === 'FAILED' || step.status === 'BLOCKED') && step.completedAt && (
          <p className="sop-meta muted">
            {STEP_STATUS_LABEL[step.status]}
            {by ? ` by ${by}` : ''} · {formatTime(step.completedAt)}
            {step.result && <span className="sop-result-chip"> {step.result}</span>}
          </p>
        )}
        {step.status === 'PENDING' && step.condition && (
          <p className="sop-meta muted">Runs only if {describeCondition(step.condition)}</p>
        )}
        {step.description && !finished && <p className="sop-desc">{step.description}</p>}
        {step.command && (
          <div className="sop-cmd">
            <code>{step.command}</code>
          </div>
        )}
        {(step.notes || step.output) && step.status !== 'IN_PROGRESS' && (
          <p className="sop-notes">{[step.notes, step.output].filter(Boolean).join(' — ')}</p>
        )}

        {step.status === 'IN_PROGRESS' && (
          <>
            <ActiveControls step={step} h={h} />
            <div className="sop-secondary">
              <button type="button" className="text-btn" disabled={h.busy} onClick={() => h.act({ status: 'BLOCKED' })}>
                Block
              </button>
              {step.type !== 'TESTING' && step.type !== 'APPROVAL' && (
                <button type="button" className="text-btn" disabled={h.busy} onClick={() => h.act({ status: 'FAILED' })}>
                  Fail
                </button>
              )}
              <button type="button" className="text-btn" disabled={h.busy} onClick={() => h.act({ status: 'SKIPPED' })}>
                Skip
              </button>
            </div>
          </>
        )}
        {(step.status === 'FAILED' || step.status === 'BLOCKED') && (
          <div className="sop-secondary">
            <button type="button" className="pill-btn sm" disabled={h.busy} onClick={() => h.act({ status: 'IN_PROGRESS' })}>
              ↻ Retry step
            </button>
            <button type="button" className="text-btn" disabled={h.busy} onClick={() => h.act({ status: 'SKIPPED' })}>
              Skip
            </button>
          </div>
        )}
      </div>
      {finished && step.status === 'VERIFIED' && (
        <button type="button" className="ghost-icon sop-rewind" title="Re-run from this step" disabled={h.busy} onClick={h.rewind}>
          ↺
        </button>
      )}
    </li>
  )
}

/** Starts an SOP by hand when nothing applies (or alongside the assigned one). */
function StartPicker({ onStart, busy }: { onStart: (sopId: string) => void; busy: boolean }) {
  const sops = useSops()
  const [sopId, setSopId] = useState('')
  return (
    <div className="sop-start">
      <select className="sop-select" value={sopId} onChange={(e) => setSopId(e.target.value)}>
        <option value="">{sops.isPending ? 'Loading SOPs…' : 'Choose an SOP…'}</option>
        {(sops.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} (v{s.version})
          </option>
        ))}
      </select>
      <button type="button" className="primary-btn sm" disabled={!sopId || busy} onClick={() => onStart(sopId)}>
        ▶ Start
      </button>
    </div>
  )
}

export function SopRunbook({ noteId, userId }: { noteId: string; userId: string }) {
  const runs = useNoteExecutions(noteId)
  const actions = useNoteExecutionActions(noteId)
  const [tab, setTab] = useState<'steps' | 'audit'>('steps')
  const [pickedRunId, setPickedRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = useMemo(() => runs.data ?? [], [runs.data])
  const run: Execution | undefined =
    list.find((r) => r.id === pickedRunId) ?? [...list].reverse().find((r) => OPEN.includes(r.status)) ?? list.at(-1)
  const stepsById = useMemo(() => new Map(run?.steps.map((s) => [s.id, s]) ?? []), [run])
  const busy = Object.values(actions).some((m) => m.isPending)

  const call = <V,>(m: { mutateAsync: (v: V) => Promise<unknown> }, vars: V) => {
    setError(null)
    m.mutateAsync(vars).catch((e: Error) => setError(e.message))
  }

  if (runs.isPending) {
    return (
      <div className="sop card">
        <LifeNoteLoader size="sm" label="Loading SOP…" />
      </div>
    )
  }
  if (runs.error) return <p className="banner error">{runs.error.message}</p>

  if (!run) {
    return (
      <div className="sop card sop-empty">
        <span className="sop-code">📘 No SOP on this ticket</span>
        <p className="muted small">
          Pick one under <strong>SOP</strong> in the details panel (or give the parent module a default), or run one once:
        </p>
        <StartPicker busy={busy} onStart={(sopId) => call(actions.start, sopId)} />
        {error && <p className="error small">{error}</p>}
      </div>
    )
  }

  const { completed, total, percent } = run.progress
  const current = run.steps.find((s) => s.id === run.progress.currentStepId)
  const isOpen = OPEN.includes(run.status)
  const handlers = (step: RunStep): StepHandlers => ({
    busy,
    userId,
    act: (body) => call(actions.act, { runId: run.id, stepId: step.id, body }),
    decide: (decision, comment) => call(actions.decide, { runId: run.id, stepId: step.id, decision, comment }),
    rewind: () => {
      if (window.confirm(`Re-run from “${step.title}”? It and every later step start over.`)) {
        call(actions.control, { runId: run.id, goToStep: step.key })
      }
    },
  })

  return (
    <div className="sop card">
      <div className="sop-head">
        <span className="sop-code">
          📘 {run.title} <span className="sop-version">v{run.sopVersion}</span>
        </span>
        <div className="sop-badges">
          <span className={`sop-run-status run-${run.status.toLowerCase()}`}>● {EXECUTION_STATUS_LABEL[run.status]}</span>
          {run.assignmentType && <span className="sop-assign">{ASSIGNMENT_LABEL[run.assignmentType]}</span>}
          <span className="muted small">
            {completed} of {total} steps ({percent}%)
          </span>
        </div>
        <div className="sop-tabs">
          <button type="button" className={tab === 'steps' ? 'on' : ''} onClick={() => setTab('steps')}>
            ☑ Steps
          </button>
          <button type="button" className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>
            ⧉ Audit trail ({run.events.length})
          </button>
          {list.length > 1 && (
            <select className="sop-select sm" value={run.id} onChange={(e) => setPickedRunId(e.target.value)} title="Runs">
              {[...list].reverse().map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} · {EXECUTION_STATUS_LABEL[r.status]} · {formatTime(r.createdAt)}
                </option>
              ))}
            </select>
          )}
          {isOpen && (
            <button
              type="button"
              className="text-btn sop-cancel"
              disabled={busy}
              onClick={() => window.confirm('Cancel this SOP run? Its history is kept.') && call(actions.control, { runId: run.id, status: 'SKIPPED' })}
            >
              Cancel run
            </button>
          )}
        </div>
      </div>

      <div className="progress sop-progress">
        <div className={`progress-fill${run.status === 'FAILED' ? ' failed' : ''}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="sop-progress-meta muted small">
        <span>{completed} done</span>
        <span>
          {current
            ? `${STEP_STATUS_LABEL[current.status]}: ${current.title}`
            : run.status === 'COMPLETED'
              ? `Completed ${run.completedAt ? formatTime(run.completedAt) : ''}`
              : EXECUTION_STATUS_LABEL[run.status]}
        </span>
        <span>{total - completed} remaining</span>
      </div>
      {error && <p className="banner error">{error}</p>}

      {tab === 'audit' ? (
        <ol className="sop-audit">
          {[...run.events].reverse().map((e) => (
            <li key={e.id}>
              <span className="sop-audit-at">{formatTime(e.createdAt)}</span>
              <span>{describeEvent(e, stepsById)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="sop-steps">
          {run.steps.map((s, i) => (
            <StepRow key={`${s.id}-${s.attempt}`} step={s} index={i} h={handlers(s)} />
          ))}
        </ol>
      )}
      {!isOpen && (
        <details className="sop-another">
          <summary className="muted small">Run an SOP again</summary>
          <StartPicker busy={busy} onStart={(sopId) => call(actions.start, sopId)} />
        </details>
      )}
    </div>
  )
}
