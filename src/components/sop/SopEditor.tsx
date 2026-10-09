import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  createRule,
  createStep,
  deleteRule,
  deleteSop,
  deleteStep,
  reorderSteps,
  updateRule,
  updateSop,
  updateStep,
  type Sop,
} from '../../api/sops'
import { sopKeys, useSop, useSopExecutions } from '../../hooks/useSops'
import {
  ACTION_LABEL,
  EXECUTION_STATUS_LABEL,
  RULE_TRIGGER_LABEL,
  STEP_TYPE_ICON,
  STEP_TYPE_LABEL,
  describeCondition,
  formatTime,
} from '../../lib/sop'
import { LifeNoteLoader } from '../LifeNoteLoader'
import { RuleForm } from './RuleForm'
import { StepForm } from './StepForm'

/** Edits one SOP definition: details, ordered steps, rules, and where it's running. */
export function SopEditor({ sopId, onDeleted }: { sopId: string; onDeleted: () => void }) {
  const qc = useQueryClient()
  const sopQuery = useSop(sopId)
  const runs = useSopExecutions(sopId)
  const [editing, setEditing] = useState<string | null>(null) // step id, rule id, 'new-step', 'new-rule'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sop = sopQuery.data
  const steps = sop?.steps ?? []
  const rules = sop?.rules ?? []
  const stepKeys = steps.map((s) => s.key)

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await Promise.all([
        qc.invalidateQueries({ queryKey: sopKeys.detail(sopId) }),
        qc.invalidateQueries({ queryKey: sopKeys.all, exact: true }),
      ])
      after?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (sopQuery.isPending) return <LifeNoteLoader label="Loading SOP…" />
  if (!sop) return <p className="banner error">{sopQuery.error?.message ?? 'SOP not found'}</p>

  const saveDetails = (patch: Partial<Pick<Sop, 'title' | 'content'>>) => run(() => updateSop(sopId, patch))
  const move = (index: number, by: -1 | 1) => {
    const ids = steps.map((s) => s.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + by, 0, moved!)
    return run(() => reorderSteps(sopId, ids))
  }

  return (
    <div className="sop-editor">
      <header className="sop-editor-head">
        <input
          key={`t-${sop.version}`}
          className="sop-title-input"
          defaultValue={sop.title}
          maxLength={200}
          onBlur={(e) => e.target.value.trim() && e.target.value !== sop.title && saveDetails({ title: e.target.value.trim() })}
        />
        <span className="sop-version">v{sop.version}</span>
        {sop.workspaceId && <span className="sop-assign">Shared</span>}
        <button
          type="button"
          className="text-btn danger"
          disabled={busy}
          onClick={() => window.confirm(`Delete “${sop.title}”? Running executions keep their copy.`) && run(() => deleteSop(sopId), onDeleted)}
        >
          Delete
        </button>
      </header>
      <textarea
        key={`c-${sop.version}`}
        className="sop-input sop-summary-input"
        rows={2}
        defaultValue={sop.content}
        placeholder="What is this procedure for?"
        onBlur={(e) => e.target.value !== sop.content && saveDetails({ content: e.target.value })}
      />
      <p className="muted small">
        Editing bumps the version. Runs already in progress keep the version they started with.
      </p>
      {error && <p className="banner error">{error}</p>}

      <section className="section">
        <div className="section-head">
          <h3 className="section-title">
            Steps <span className="count-chip">{steps.length}</span>
          </h3>
          <button type="button" className="accent-link" onClick={() => setEditing('new-step')}>
            + Add step
          </button>
        </div>
        <ol className="def-list">
          {steps.map((s, i) => (
            <li key={s.id} className="def-item">
              {editing === s.id ? (
                <StepForm
                  step={s}
                  stepKeys={stepKeys}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => run(() => updateStep(sopId, s.id, input), () => setEditing(null))}
                />
              ) : (
                <div className="def-row">
                  <span className="def-index">{i + 1}</span>
                  <div className="def-main" onClick={() => setEditing(s.id)}>
                    <div className="def-title">
                      {s.title}
                      <span className="sop-type">
                        {STEP_TYPE_ICON[s.type]} {STEP_TYPE_LABEL[s.type]}
                      </span>
                      {s.requiresSignoff && <span className="sop-type">sign-off</span>}
                    </div>
                    <div className="def-sub muted small">
                      <code>{s.key}</code>
                      {s.condition && <> · only if {describeCondition(s.condition)}</>}
                      {s.type === 'APPROVAL' && <> · {Number(s.config.requiredApprovals ?? 1)} approval(s)</>}
                    </div>
                  </div>
                  <div className="def-actions">
                    <button type="button" className="ghost-icon" title="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button type="button" className="ghost-icon" title="Move down" disabled={busy || i === steps.length - 1} onClick={() => move(i, 1)}>
                      ↓
                    </button>
                    <button type="button" className="ghost-icon" title="Edit" onClick={() => setEditing(s.id)}>
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost-icon"
                      title="Delete step"
                      disabled={busy}
                      onClick={() => window.confirm(`Delete step “${s.title}”?`) && run(() => deleteStep(sopId, s.id))}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {editing === 'new-step' && (
            <li className="def-item">
              <StepForm
                stepKeys={stepKeys}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(input) => run(() => createStep(sopId, input), () => setEditing(null))}
              />
            </li>
          )}
          {steps.length === 0 && editing !== 'new-step' && <p className="muted small">No steps yet — add the first one.</p>}
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <h3 className="section-title">
            Rules <span className="count-chip">{rules.length}</span>
          </h3>
          <button type="button" className="accent-link" onClick={() => setEditing('new-rule')}>
            + Add rule
          </button>
        </div>
        <p className="muted small">React to what happens during a run — e.g. send failed QA back to development.</p>
        <ul className="def-list">
          {rules.map((r) => (
            <li key={r.id} className="def-item">
              {editing === r.id ? (
                <RuleForm
                  rule={r}
                  stepKeys={stepKeys}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => run(() => updateRule(sopId, r.id, input), () => setEditing(null))}
                />
              ) : (
                <div className={`def-row${r.enabled ? '' : ' disabled'}`}>
                  <input
                    type="checkbox"
                    title={r.enabled ? 'Enabled' : 'Disabled'}
                    checked={r.enabled}
                    disabled={busy}
                    onChange={() => run(() => updateRule(sopId, r.id, { enabled: !r.enabled }))}
                  />
                  <div className="def-main" onClick={() => setEditing(r.id)}>
                    <div className="def-title">{r.name}</div>
                    <div className="def-sub muted small">
                      When <strong>{RULE_TRIGGER_LABEL[r.trigger] ?? r.trigger}</strong> and {describeCondition(r.condition)} →{' '}
                      {r.actions.map((a) => `${ACTION_LABEL[a.type]}${'stepKey' in a ? ` ${a.stepKey}` : ''}`).join(', ')}
                    </div>
                  </div>
                  <div className="def-actions">
                    <button type="button" className="ghost-icon" title="Edit" onClick={() => setEditing(r.id)}>
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost-icon"
                      title="Delete rule"
                      disabled={busy}
                      onClick={() => window.confirm(`Delete rule “${r.name}”?`) && run(() => deleteRule(sopId, r.id))}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {editing === 'new-rule' && (
            <li className="def-item">
              <RuleForm
                stepKeys={stepKeys}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(input) => run(() => createRule(sopId, input), () => setEditing(null))}
              />
            </li>
          )}
        </ul>
      </section>

      <section className="section">
        <h3 className="section-title">
          Runs <span className="count-chip">{runs.data?.length ?? 0}</span>
        </h3>
        {runs.data?.length ? (
          <table className="runs-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Status</th>
                <th>Current step</th>
                <th>Progress</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.note?.title ?? r.issue?.key ?? r.task?.title ?? '—'}</td>
                  <td>
                    <span className={`sop-run-status run-${r.status.toLowerCase()}`}>{EXECUTION_STATUS_LABEL[r.status]}</span>
                  </td>
                  <td>{r.currentStep?.title ?? '—'}</td>
                  <td>
                    {r.progress.completed}/{r.progress.total} <span className="muted">v{r.sopVersion}</span>
                  </td>
                  <td className="muted">{formatTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted small">Not running anywhere yet. Assign it to a ticket or module from the ticket's details panel.</p>
        )}
      </section>
    </div>
  )
}
