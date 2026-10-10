import { useState } from 'react'
import type { ConfigOverride, SopStepDef, StepConfig, StepInput, StepType } from '../../api/sops'
import { useSopMeta } from '../../hooks/useSops'
import { describeCondition, slugKey } from '../../lib/sopConditions'
import { defaultConfig } from '../../lib/sopUi'
import { ActionEditor } from './ActionEditor'
import { ConditionBuilder } from './ConditionBuilder'

type StepOption = { key: string; title: string }

/** Full editor for one SOP step: basics, "only when" condition, and type-specific config. */
export function StepEditor({
  step,
  steps,
  onSave,
  onCancel,
}: {
  step: SopStepDef
  steps: StepOption[]
  onSave: (input: StepInput) => Promise<void>
  onCancel: () => void
}) {
  const { data: meta } = useSopMeta()
  const [draft, setDraft] = useState<StepInput>({
    key: step.key,
    title: step.title,
    description: step.description,
    command: step.command,
    requiresSignoff: step.requiresSignoff,
    type: step.type,
    config: step.config ?? {},
    condition: step.condition,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const config = draft.config ?? {}
  const setConfig = (patch: Partial<StepConfig>) => setDraft((d) => ({ ...d, config: { ...d.config, ...patch } }))
  const otherSteps = steps.filter((s) => s.key !== step.key)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...draft, command: draft.command?.trim() ? draft.command : null })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="step-editor">
      <div className="form-grid">
        <label>
          <span>Title</span>
          <input className="sop-input" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <label>
          <span>Type</span>
          <select
            className="sop-select"
            value={draft.type}
            onChange={(e) => {
              const type = e.target.value as StepType
              setDraft({ ...draft, type, config: defaultConfig(type, config) })
            }}
          >
            {meta?.stepTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Key</span>
          <input
            className="sop-input mono"
            value={draft.key}
            title="Used by conditions (steps.<key>.status) and rules (Go to step)"
            onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          />
        </label>
      </div>
      <p className="muted small">{meta?.stepTypes.find((t) => t.type === draft.type)?.description}</p>

      <label className="field">
        <span>Instructions</span>
        <textarea
          className="sop-input"
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Command (optional)</span>
        <input
          className="sop-input mono"
          value={draft.command ?? ''}
          placeholder="e.g. kubectl rollout restart deployment/api"
          onChange={(e) => setDraft({ ...draft, command: e.target.value })}
        />
      </label>
      <div className="chips">
        <label className="chip-check">
          <input type="checkbox" checked={!!draft.requiresSignoff} onChange={(e) => setDraft({ ...draft, requiresSignoff: e.target.checked })} />
          Requires sign-off notes
        </label>
        <label className="chip-check">
          <input type="checkbox" checked={!!config.mandatory} onChange={(e) => setConfig({ mandatory: e.target.checked })} />
          Mandatory (can't be skipped)
        </label>
      </div>

      <TypeConfig type={draft.type!} config={config} setConfig={setConfig} steps={otherSteps} />

      <fieldset className="sop-fieldset">
        <legend>Only run this step when</legend>
        <ConditionBuilder
          value={draft.condition ?? null}
          onChange={(condition) => setDraft((d) => ({ ...d, condition }))}
          steps={otherSteps}
          emptyLabel="Always runs"
        />
      </fieldset>

      <OverridesEditor overrides={config.overrides ?? []} onChange={(overrides) => setConfig({ overrides: overrides.length ? overrides : undefined })} steps={otherSteps} />

      {error && <p className="error small">{error}</p>}
      <div className="row-actions">
        <button type="button" className="primary-btn sm" disabled={saving || !draft.title?.trim()} onClick={save}>
          {saving ? 'Saving…' : 'Save step'}
        </button>
        <button type="button" className="text-btn sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function TypeConfig({
  type,
  config,
  setConfig,
  steps,
}: {
  type: StepType
  config: StepConfig
  setConfig: (patch: Partial<StepConfig>) => void
  steps: StepOption[]
}) {
  const { data: meta } = useSopMeta()

  switch (type) {
    case 'CHECKLIST': {
      const items = config.items ?? []
      return (
        <fieldset className="sop-fieldset">
          <legend>Checklist items</legend>
          {items.map((item, i) => (
            <div key={item.key} className="cond-leaf">
              <input
                className="sop-input sm grow"
                value={item.label}
                onChange={(e) => setConfig({ items: items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <label className="chip-check small">
                <input
                  type="checkbox"
                  checked={item.required !== false}
                  onChange={(e) => setConfig({ items: items.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })}
                />
                required
              </label>
              <button
                type="button"
                className="row-remove visible"
                aria-label="Remove item"
                onClick={() => setConfig({ items: items.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-btn sm"
            onClick={() =>
              setConfig({ items: [...items, { key: slugKey(`item ${items.length + 1}`, items.map((x) => x.key)), label: '', required: true }] })
            }
          >
            + Item
          </button>
        </fieldset>
      )
    }
    case 'APPROVAL':
      return (
        <fieldset className="sop-fieldset">
          <legend>Approval</legend>
          <div className="form-grid">
            <label>
              <span>Approvals needed</span>
              <input
                className="sop-input"
                type="number"
                min={1}
                max={20}
                value={config.requiredApprovals ?? 1}
                onChange={(e) => setConfig({ requiredApprovals: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label>
              <span>Approver user ids (optional)</span>
              <input
                className="sop-input"
                value={(config.approverIds ?? []).join(', ')}
                placeholder="anyone with access"
                onChange={(e) => {
                  const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  setConfig({ approverIds: ids.length ? ids : undefined })
                }}
              />
            </label>
          </div>
          <div className="chips">
            <span className="muted small">Roles (workspace issues):</span>
            {(['OWNER', 'ADMIN', 'MEMBER'] as const).map((role) => (
              <label key={role} className="chip-check small">
                <input
                  type="checkbox"
                  checked={config.approverRoles?.includes(role) ?? false}
                  onChange={(e) => {
                    const roles = e.target.checked
                      ? [...(config.approverRoles ?? []), role]
                      : (config.approverRoles ?? []).filter((r) => r !== role)
                    setConfig({ approverRoles: roles.length ? roles : undefined })
                  }}
                />
                {role.toLowerCase()}
              </label>
            ))}
            <label className="chip-check small">
              <input
                type="checkbox"
                checked={!!config.preventSelfApproval}
                onChange={(e) => setConfig({ preventSelfApproval: e.target.checked || undefined })}
              />
              Not by whoever did the work
            </label>
          </div>
        </fieldset>
      )
    case 'TESTING':
      return (
        <label className="chip-check">
          <input type="checkbox" checked={config.requireResult !== false} onChange={(e) => setConfig({ requireResult: e.target.checked })} />
          A PASSED / FAILED result is required (FAILED fails the step)
        </label>
      )
    case 'CONFIRMATION':
      return (
        <label className="field">
          <span>Confirmation text</span>
          <input
            className="sop-input"
            value={config.confirmationText ?? ''}
            placeholder="e.g. I confirm the deployment is healthy"
            onChange={(e) => setConfig({ confirmationText: e.target.value || undefined })}
          />
        </label>
      )
    case 'CONDITION':
      return (
        <fieldset className="sop-fieldset">
          <legend>Check</legend>
          <ConditionBuilder value={config.check ?? null} onChange={(check) => setConfig({ check: check ?? undefined })} steps={steps} />
          <div className="form-grid">
            <label>
              <span>When true, go to</span>
              <StepSelect value={config.onTrueGoto} steps={steps} empty="next step" onChange={(onTrueGoto) => setConfig({ onTrueGoto })} />
            </label>
            <label>
              <span>When false</span>
              <select
                className="sop-select"
                value={config.onFalseGoto ? 'GOTO' : (config.onFalse ?? 'FAIL')}
                onChange={(e) =>
                  e.target.value === 'GOTO'
                    ? setConfig({ onFalseGoto: steps[0]?.key })
                    : setConfig({ onFalse: e.target.value as StepConfig['onFalse'], onFalseGoto: undefined })
                }
              >
                <option value="FAIL">Fail the step</option>
                <option value="BLOCK">Block the runbook</option>
                <option value="CONTINUE">Continue anyway</option>
                <option value="GOTO">Go to a step…</option>
              </select>
            </label>
            {config.onFalseGoto !== undefined && (
              <label>
                <span>Go to</span>
                <StepSelect value={config.onFalseGoto} steps={steps} onChange={(onFalseGoto) => setConfig({ onFalseGoto })} />
              </label>
            )}
          </div>
        </fieldset>
      )
    case 'GITHUB_ACTION':
      return (
        <fieldset className="sop-fieldset">
          <legend>GitHub</legend>
          <div className="form-grid">
            <label>
              <span>Completes on</span>
              <select className="sop-select" value={config.event ?? ''} onChange={(e) => setConfig({ event: e.target.value || undefined })}>
                <option value="">Callback / manual only</option>
                {meta?.githubEvents.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Repository</span>
              <input className="sop-input" value={config.repository ?? ''} placeholder="owner/repo (any)" onChange={(e) => setConfig({ repository: e.target.value || undefined })} />
            </label>
            <label>
              <span>Branch</span>
              <input className="sop-input" value={config.branch ?? ''} placeholder="e.g. main (any)" onChange={(e) => setConfig({ branch: e.target.value || undefined })} />
            </label>
            <label>
              <span>Workflow</span>
              <input className="sop-input" value={config.workflow ?? ''} placeholder="workflow name (any)" onChange={(e) => setConfig({ workflow: e.target.value || undefined })} />
            </label>
          </div>
          <p className="muted small">
            Matches issue keys in PR titles / branches for workspace issues. Any runbook can also be finished by CI through the step's
            callback URL.
          </p>
        </fieldset>
      )
    case 'AUTOMATED_ACTION':
      return (
        <fieldset className="sop-fieldset">
          <legend>Automation</legend>
          <label className="chip-check">
            <input
              type="radio"
              checked={!!config.action}
              onChange={() => setConfig({ action: { type: 'SET_SUBJECT_STATUS', status: 'IN_REVIEW' } })}
            />
            Run an action immediately
          </label>
          {config.action && <ActionEditor action={config.action} onChange={(action) => setConfig({ action })} steps={steps} />}
          <label className="chip-check">
            <input type="radio" checked={!config.action} onChange={() => setConfig({ action: undefined })} />
            Wait for an external callback (CI, script)
          </label>
        </fieldset>
      )
    default:
      return null
  }
}

function StepSelect({
  value,
  steps,
  onChange,
  empty,
}: {
  value: string | undefined
  steps: StepOption[]
  onChange: (key: string | undefined) => void
  empty?: string
}) {
  return (
    <select className="sop-select" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {empty && <option value="">{empty}</option>}
      {steps.map((s) => (
        <option key={s.key} value={s.key}>
          {s.title}
        </option>
      ))}
    </select>
  )
}

/** "When X, use these config values instead" — e.g. HIGH risk → 2 approvals. */
function OverridesEditor({
  overrides,
  onChange,
  steps,
}: {
  overrides: ConfigOverride[]
  onChange: (overrides: ConfigOverride[]) => void
  steps: StepOption[]
}) {
  const { data: meta } = useSopMeta()
  return (
    <fieldset className="sop-fieldset">
      <legend>Conditional settings</legend>
      {overrides.length === 0 && <p className="muted small">Change this step's settings for some tasks, e.g. require 2 approvals when risk is HIGH.</p>}
      {overrides.map((override, i) => (
        <div key={i} className="override">
          <div className="override-head small">
            <span>
              When <em>{describeCondition(override.when, meta)}</em>
            </span>
            <button type="button" className="row-remove visible" aria-label="Remove" onClick={() => onChange(overrides.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
          <ConditionBuilder
            value={override.when}
            onChange={(when) => onChange(overrides.map((o, j) => (j === i ? { ...o, when: when ?? { field: 'issue.status', operator: 'EXISTS' } } : o)))}
            steps={steps}
          />
          <KeyValueEditor
            values={override.set}
            onChange={(set) => onChange(overrides.map((o, j) => (j === i ? { ...o, set } : o)))}
          />
        </div>
      ))}
      <button
        type="button"
        className="text-btn sm"
        onClick={() =>
          onChange([
            ...overrides,
            { when: { field: 'fields.riskLevel', operator: 'EQUALS', value: 'HIGH' }, set: { requiredApprovals: 2 } },
          ])
        }
      >
        + Conditional setting
      </button>
    </fieldset>
  )
}

function KeyValueEditor({ values, onChange }: { values: Record<string, unknown>; onChange: (values: Record<string, unknown>) => void }) {
  const entries = Object.entries(values)
  const parse = (raw: string): unknown => (raw === 'true' ? true : raw === 'false' ? false : raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw)
  return (
    <div className="kv-editor">
      <span className="muted small">use</span>
      {entries.map(([key, value], i) => (
        <div key={i} className="cond-leaf">
          <input
            className="sop-input sm key-input"
            value={key}
            onChange={(e) => {
              const next = Object.fromEntries(entries.map(([k, v], j) => (j === i ? [e.target.value, v] : [k, v])))
              onChange(next)
            }}
          />
          <span className="muted small">=</span>
          <input
            className="sop-input sm"
            value={String(value)}
            onChange={(e) => onChange({ ...values, [key]: parse(e.target.value) })}
          />
          <button
            type="button"
            className="row-remove visible"
            aria-label="Remove"
            onClick={() => onChange(Object.fromEntries(entries.filter((_, j) => j !== i)))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-btn sm"
        onClick={() => onChange({ ...values, [slugKey('setting', Object.keys(values))]: '' })}
      >
        + Setting
      </button>
    </div>
  )
}
