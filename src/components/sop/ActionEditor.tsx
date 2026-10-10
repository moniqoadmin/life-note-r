import type { ActionType, SopAction } from '../../api/sops'
import { useSopMeta } from '../../hooks/useSops'

const DEFAULTS: Record<ActionType, SopAction> = {
  SET_SUBJECT_STATUS: { type: 'SET_SUBJECT_STATUS', status: 'IN_PROGRESS' },
  SET_ISSUE_STATUS: { type: 'SET_SUBJECT_STATUS', status: 'IN_PROGRESS' },
  SET_RUNBOOK_STATUS: { type: 'SET_RUNBOOK_STATUS', status: 'BLOCKED' },
  GOTO_STEP: { type: 'GOTO_STEP', stepKey: '' },
  SKIP_STEP: { type: 'SKIP_STEP', stepKey: '' },
  ADD_LABEL: { type: 'ADD_LABEL', label: '' },
  REMOVE_LABEL: { type: 'REMOVE_LABEL', label: '' },
  SET_FIELD: { type: 'SET_FIELD', field: '', value: '' },
  NOTIFY: { type: 'NOTIFY', recipients: ['OWNER'], userIds: [], message: '' },
}

/** Editor for one rule / automated-step action, driven by the backend's action catalog. */
export function ActionEditor({
  action,
  onChange,
  onRemove,
  steps,
}: {
  action: SopAction
  onChange: (action: SopAction) => void
  onRemove?: () => void
  steps: { key: string; title: string }[]
}) {
  const { data: meta } = useSopMeta()
  const type = action.type === 'SET_ISSUE_STATUS' ? 'SET_SUBJECT_STATUS' : action.type
  const def = meta?.actions.find((a) => a.type === type)

  return (
    <div className="action-row">
      <select
        className="sop-select sm"
        value={type}
        onChange={(e) => {
          const next = { ...DEFAULTS[e.target.value as ActionType] }
          if ('stepKey' in next) next.stepKey = steps[0]?.key ?? ''
          onChange(next)
        }}
      >
        {(meta?.actions ?? []).map((a) => (
          <option key={a.type} value={a.type}>
            {a.label}
          </option>
        ))}
      </select>

      {'status' in action && (
        <select
          className="sop-select sm"
          value={action.status}
          onChange={(e) => onChange({ ...action, status: e.target.value } as SopAction)}
        >
          {(def?.statuses ?? [action.status]).map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      )}

      {'stepKey' in action && (
        <select className="sop-select sm" value={action.stepKey} onChange={(e) => onChange({ ...action, stepKey: e.target.value })}>
          {!steps.some((s) => s.key === action.stepKey) && <option value={action.stepKey}>{action.stepKey || '— step —'}</option>}
          {steps.map((s) => (
            <option key={s.key} value={s.key}>
              {s.title}
            </option>
          ))}
        </select>
      )}

      {'label' in action && (
        <input
          className="sop-input sm"
          value={action.label}
          placeholder="label"
          maxLength={40}
          onChange={(e) => onChange({ ...action, label: e.target.value })}
        />
      )}

      {action.type === 'SET_FIELD' && (
        <>
          <input
            className="sop-input sm key-input"
            value={action.field}
            placeholder="fieldName"
            onChange={(e) => onChange({ ...action, field: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
          />
          <span className="muted small">=</span>
          <input
            className="sop-input sm"
            value={action.value === null ? '' : String(action.value)}
            placeholder="value"
            onChange={(e) => onChange({ ...action, value: e.target.value })}
          />
        </>
      )}

      {action.type === 'NOTIFY' && (
        <div className="action-notify">
          <div className="chips">
            {(meta?.notifyRecipients ?? ['OWNER']).map((r) => (
              <label key={r} className="chip-check small">
                <input
                  type="checkbox"
                  checked={action.recipients.includes(r as never)}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      recipients: e.target.checked
                        ? [...action.recipients, r as (typeof action.recipients)[number]]
                        : action.recipients.filter((x) => x !== r),
                    })
                  }
                />
                {r.toLowerCase()}
              </label>
            ))}
          </div>
          <input
            className="sop-input sm"
            value={action.message}
            placeholder="Message"
            maxLength={500}
            onChange={(e) => onChange({ ...action, message: e.target.value })}
          />
        </div>
      )}

      {onRemove && (
        <button type="button" className="row-remove visible" aria-label="Remove action" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}
