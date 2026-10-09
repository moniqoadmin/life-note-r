import { useState } from 'react'
import type { SopAction, SopActionType } from '../../api/sops'
import { ACTION_LABEL } from '../../lib/sop'

const ISSUE_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE']
const RUN_STATUSES = ['FAILED', 'BLOCKED', 'SKIPPED']

/** A sensible starting action for each type. */
function blank(type: SopActionType, stepKey: string): SopAction {
  switch (type) {
    case 'SET_ISSUE_STATUS':
      return { type, status: 'IN_PROGRESS' }
    case 'SET_TASK_STATUS':
      return { type, status: 'IN_PROGRESS' }
    case 'SET_RUNBOOK_STATUS':
      return { type, status: 'BLOCKED' }
    case 'GO_TO_STEP':
    case 'SKIP_STEP':
      return { type, stepKey }
    case 'REQUIRE_APPROVALS':
      return { type, stepKey, count: 2 }
    case 'SET_STEP_CONFIG':
      return { type, stepKey, config: {} }
    case 'ADD_LABEL':
    case 'REMOVE_LABEL':
      return { type, label: '' }
    case 'ASSIGN_ISSUE':
      return { type, userId: null }
    case 'SET_ISSUE_FIELD':
      return { type, field: '', value: '' }
  }
}

function ConfigJson({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const [text, setText] = useState(JSON.stringify(value))
  const [bad, setBad] = useState(false)
  return (
    <input
      className={`sop-input mono${bad ? ' invalid' : ''}`}
      value={text}
      placeholder='{"requiredApprovals": 2}'
      onChange={(e) => {
        setText(e.target.value)
        try {
          onChange(JSON.parse(e.target.value))
          setBad(false)
        } catch {
          setBad(true)
        }
      }}
    />
  )
}

/** Ordered list of actions (rule "then" / AUTOMATED_ACTION step). */
export function ActionsEditor({
  value,
  onChange,
  stepKeys,
}: {
  value: SopAction[]
  onChange: (actions: SopAction[]) => void
  stepKeys: string[]
}) {
  const set = (i: number, a: SopAction) => onChange(value.map((x, j) => (j === i ? a : x)))
  const stepSelect = (i: number, a: Extract<SopAction, { stepKey: string }>) => (
    <select className="sop-select" value={a.stepKey} onChange={(e) => set(i, { ...a, stepKey: e.target.value })}>
      {!stepKeys.includes(a.stepKey) && <option value={a.stepKey}>{a.stepKey || '— step —'}</option>}
      {stepKeys.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  )
  const statusSelect = (i: number, a: SopAction & { status: string }, options: string[]) => (
    <select className="sop-select" value={a.status} onChange={(e) => set(i, { ...a, status: e.target.value } as SopAction)}>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )

  return (
    <div className="actions-ed">
      {value.length === 0 && <p className="muted small">No actions yet.</p>}
      {value.map((a, i) => (
        <div key={i} className="cond-row">
          <select
            className="sop-select"
            value={a.type}
            onChange={(e) => set(i, blank(e.target.value as SopActionType, stepKeys[0] ?? ''))}
          >
            {(Object.keys(ACTION_LABEL) as SopActionType[]).map((t) => (
              <option key={t} value={t}>
                {ACTION_LABEL[t]}
              </option>
            ))}
          </select>
          {a.type === 'SET_ISSUE_STATUS' && statusSelect(i, a, ISSUE_STATUSES)}
          {a.type === 'SET_TASK_STATUS' && statusSelect(i, a, TASK_STATUSES)}
          {a.type === 'SET_RUNBOOK_STATUS' && statusSelect(i, a, RUN_STATUSES)}
          {(a.type === 'GO_TO_STEP' || a.type === 'SKIP_STEP') && stepSelect(i, a)}
          {a.type === 'REQUIRE_APPROVALS' && (
            <>
              {stepSelect(i, a)}
              <input
                className="sop-input num"
                type="number"
                min={1}
                max={20}
                value={a.count}
                onChange={(e) => set(i, { ...a, count: Math.max(1, Number(e.target.value) || 1) })}
              />
            </>
          )}
          {a.type === 'SET_STEP_CONFIG' && (
            <>
              {stepSelect(i, a)}
              <ConfigJson value={a.config} onChange={(config) => set(i, { ...a, config })} />
            </>
          )}
          {(a.type === 'ADD_LABEL' || a.type === 'REMOVE_LABEL') && (
            <input className="sop-input" value={a.label} placeholder="label" onChange={(e) => set(i, { ...a, label: e.target.value })} />
          )}
          {a.type === 'ASSIGN_ISSUE' && (
            <input
              className="sop-input mono"
              value={a.userId ?? ''}
              placeholder="user id (empty = unassign)"
              onChange={(e) => set(i, { ...a, userId: e.target.value || null })}
            />
          )}
          {a.type === 'SET_ISSUE_FIELD' && (
            <>
              <input className="sop-input mono" value={a.field} placeholder="riskLevel" onChange={(e) => set(i, { ...a, field: e.target.value })} />
              <input
                className="sop-input"
                value={String(a.value ?? '')}
                placeholder="value"
                onChange={(e) => set(i, { ...a, value: e.target.value })}
              />
            </>
          )}
          <button type="button" className="row-remove" aria-label="Remove action" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="accent-link" onClick={() => onChange([...value, blank('GO_TO_STEP', stepKeys[0] ?? '')])}>
        + Add action
      </button>
      <p className="muted small">Issue/task actions only apply when the SOP runs on an issue or task.</p>
    </div>
  )
}
