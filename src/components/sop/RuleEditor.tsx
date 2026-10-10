import { useState } from 'react'
import type { RuleInput, RuleTrigger, SopRule } from '../../api/sops'
import { useSopMeta } from '../../hooks/useSops'
import { defaultAction, triggerLabel } from '../../lib/sopUi'
import { ActionEditor } from './ActionEditor'
import { ConditionBuilder } from './ConditionBuilder'

/** "WHEN <trigger> IF <condition> THEN <actions>" editor for an SOP rule. */
export function RuleEditor({
  rule,
  steps,
  onSave,
  onCancel,
}: {
  rule: SopRule | RuleInput
  steps: { key: string; title: string }[]
  onSave: (input: RuleInput) => Promise<void>
  onCancel: () => void
}) {
  const { data: meta } = useSopMeta()
  const [draft, setDraft] = useState<RuleInput>({
    name: rule.name,
    trigger: rule.trigger,
    condition: rule.condition,
    actions: rule.actions,
    enabled: rule.enabled,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  return (
    <div className="step-editor">
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input
            className="sop-input"
            value={draft.name}
            maxLength={200}
            placeholder="e.g. QA failed → back to development"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          <span>When</span>
          <select className="sop-select" value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value as RuleTrigger })}>
            {(meta?.triggers ?? []).map((t) => (
              <option key={t} value={t}>
                {triggerLabel(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="sop-fieldset">
        <legend>If</legend>
        <p className="muted small">Use “Triggering step” to react to one specific step.</p>
        <ConditionBuilder value={draft.condition} onChange={(condition) => setDraft((d) => ({ ...d, condition }))} steps={steps} />
      </fieldset>
      <fieldset className="sop-fieldset">
        <legend>Then</legend>
        {draft.actions.map((action, i) => (
          <ActionEditor
            key={i}
            action={action}
            steps={steps}
            onChange={(a) => setDraft((d) => ({ ...d, actions: d.actions.map((x, j) => (j === i ? a : x)) }))}
            onRemove={draft.actions.length > 1 ? () => setDraft((d) => ({ ...d, actions: d.actions.filter((_, j) => j !== i) })) : undefined}
          />
        ))}
        <button type="button" className="text-btn sm" onClick={() => setDraft((d) => ({ ...d, actions: [...d.actions, defaultAction(steps)] }))}>
          + Action
        </button>
      </fieldset>
      <label className="chip-check">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        Enabled
      </label>
      {error && <p className="error small">{error}</p>}
      <div className="row-actions">
        <button
          type="button"
          className="primary-btn sm"
          disabled={saving || !draft.name.trim()}
          onClick={async () => {
            setSaving(true)
            setError(null)
            try {
              await onSave(draft)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : 'Save rule'}
        </button>
        <button type="button" className="text-btn sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
