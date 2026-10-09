import { useState } from 'react'
import { RULE_TRIGGERS, type Condition, type RuleTrigger, type SopAction, type SopRule, type SopRuleInput } from '../../api/sops'
import { RULE_TRIGGER_LABEL } from '../../lib/sop'
import { ActionsEditor } from './ActionsEditor'
import { ConditionEditor } from './ConditionEditor'


/** Create or edit a rule: WHEN trigger AND condition THEN actions. */
export function RuleForm({
  rule,
  stepKeys,
  busy,
  onSave,
  onCancel,
}: {
  rule?: SopRule
  stepKeys: string[]
  busy: boolean
  onSave: (input: SopRuleInput) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(rule?.name ?? '')
  const [trigger, setTrigger] = useState<RuleTrigger>(rule?.trigger ?? 'STEP_FAILED')
  const [condition, setCondition] = useState<Condition | null>(rule?.condition ?? null)
  const [actions, setActions] = useState<SopAction[]>(rule?.actions ?? [])
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  // Rules need a condition; "always" is expressed as a check that's always true.
  const always: Condition = { field: 'execution.status', operator: 'EXISTS' }

  return (
    <div className="step-form">
      <div className="sop-grid">
        <label className="sop-field grow">
          <span>Name</span>
          <input className="sop-input" value={name} autoFocus maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="QA failed → back to development" />
        </label>
        <label className="sop-field">
          <span>When</span>
          <select className="sop-select" value={trigger} onChange={(e) => setTrigger(e.target.value as RuleTrigger)}>
            {RULE_TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {RULE_TRIGGER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="sop-check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>
      </div>
      <div className="sop-field">
        <span>…and this holds (use event.step.key to target one step)</span>
        <ConditionEditor value={condition} onChange={setCondition} stepKeys={stepKeys} emptyLabel="Always." />
      </div>
      <div className="sop-field">
        <span>Then</span>
        <ActionsEditor value={actions} onChange={setActions} stepKeys={stepKeys} />
      </div>
      <div className="form-actions">
        <button type="button" className="text-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-btn sm"
          disabled={busy || !name.trim() || actions.length === 0}
          onClick={() => onSave({ name: name.trim(), trigger, condition: condition ?? always, actions, enabled })}
        >
          {rule ? 'Save rule' : 'Add rule'}
        </button>
      </div>
    </div>
  )
}
