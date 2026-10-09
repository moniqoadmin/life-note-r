import { useState } from 'react'
import { STEP_TYPES, type Condition, type SopAction, type SopStep, type SopStepInput, type SopStepType } from '../../api/sops'
import { STEP_TYPE_HINT, STEP_TYPE_LABEL } from '../../lib/sop'
import { ActionsEditor } from './ActionsEditor'
import { ConditionEditor } from './ConditionEditor'

type Config = Record<string, unknown>
type Transition = { then: 'CONTINUE' | 'FAIL' | 'BLOCK' | 'GO_TO_STEP'; stepKey?: string }

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item'

/** "?" at the start of a line marks an optional checklist item. */
function itemsToText(items: unknown) {
  return Array.isArray(items)
    ? items.map((i: { label: string; required?: boolean }) => `${i.required === false ? '?' : ''}${i.label}`).join('\n')
    : ''
}

function textToItems(text: string) {
  const used = new Set<string>()
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const optional = line.startsWith('?')
      const label = optional ? line.slice(1).trim() : line
      let id = slug(label)
      for (let n = 2; used.has(id); n++) id = `${slug(label)}-${n}`
      used.add(id)
      return { id, label, required: !optional }
    })
}

function TransitionPicker({ value, onChange, stepKeys }: { value: Transition; onChange: (t: Transition) => void; stepKeys: string[] }) {
  return (
    <span className="cond-row inline">
      <select
        className="sop-select"
        value={value.then}
        onChange={(e) => {
          const then = e.target.value as Transition['then']
          onChange(then === 'GO_TO_STEP' ? { then, stepKey: stepKeys[0] ?? '' } : { then })
        }}
      >
        <option value="CONTINUE">continue</option>
        <option value="FAIL">fail the run</option>
        <option value="BLOCK">block the run</option>
        <option value="GO_TO_STEP">go to step…</option>
      </select>
      {value.then === 'GO_TO_STEP' && (
        <select className="sop-select" value={value.stepKey} onChange={(e) => onChange({ then: 'GO_TO_STEP', stepKey: e.target.value })}>
          {stepKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      )}
    </span>
  )
}

function ConfigEditor({
  type,
  config,
  onChange,
  stepKeys,
}: {
  type: SopStepType
  config: Config
  onChange: (c: Config) => void
  stepKeys: string[]
}) {
  const [checklist, setChecklist] = useState(itemsToText(config.items))
  const set = (patch: Config) => onChange({ ...config, ...patch })

  switch (type) {
    case 'CHECKLIST':
      return (
        <label className="sop-field">
          <span>Items — one per line, start with ? for optional</span>
          <textarea
            className="sop-input"
            rows={4}
            value={checklist}
            placeholder={'Unit tests written\nMigrations reviewed\n?Docs updated'}
            onChange={(e) => {
              setChecklist(e.target.value)
              set({ items: textToItems(e.target.value) })
            }}
          />
        </label>
      )
    case 'APPROVAL': {
      const approvers = (config.approvers as { roles?: string[]; projectLead?: boolean } | undefined) ?? {}
      const roles = approvers.roles ?? []
      const toggleRole = (r: string) => {
        const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]
        set({ approvers: { ...approvers, roles: next.length ? next : undefined } })
      }
      return (
        <div className="sop-grid">
          <label className="sop-field">
            <span>Approvals required</span>
            <input
              className="sop-input num"
              type="number"
              min={1}
              max={20}
              value={Number(config.requiredApprovals ?? 1)}
              onChange={(e) => set({ requiredApprovals: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <div className="sop-field">
            <span>Who can approve (workspace roles; none = anyone)</span>
            <div className="sop-checks">
              {['OWNER', 'ADMIN', 'MEMBER'].map((r) => (
                <label key={r}>
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} /> {r.toLowerCase()}
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={approvers.projectLead === true}
                  onChange={(e) => set({ approvers: { ...approvers, projectLead: e.target.checked || undefined } })}
                />{' '}
                project lead
              </label>
            </div>
          </div>
        </div>
      )
    }
    case 'GITHUB_ACTION':
      return (
        <div className="sop-grid">
          <label className="sop-field">
            <span>Completes when</span>
            <select className="sop-select" value={String(config.event ?? 'PR_MERGED')} onChange={(e) => set({ event: e.target.value })}>
              <option value="PR_OPENED">a PR is opened</option>
              <option value="PR_MERGED">a PR is merged</option>
              <option value="CHECKS_PASSED">CI checks pass</option>
            </select>
          </label>
          <label className="sop-field">
            <span>Into branch (optional)</span>
            <input
              className="sop-input mono"
              value={String(config.baseBranch ?? '')}
              placeholder="main"
              onChange={(e) => set({ baseBranch: e.target.value || undefined })}
            />
          </label>
          <label className="sop-check">
            <input
              type="checkbox"
              checked={config.allowManualCompletion !== false}
              onChange={(e) => set({ allowManualCompletion: e.target.checked })}
            />{' '}
            Allow marking done manually
          </label>
        </div>
      )
    case 'CONDITION':
      return (
        <div className="sop-field">
          <span>Check</span>
          <ConditionEditor
            value={(config.condition as Condition | undefined) ?? null}
            onChange={(c) => set({ condition: c ?? undefined })}
            stepKeys={stepKeys}
            emptyLabel="Add at least one rule."
          />
          <div className="sop-grid">
            <label className="sop-field">
              <span>If true</span>
              <TransitionPicker value={(config.onTrue as Transition) ?? { then: 'CONTINUE' }} onChange={(onTrue) => set({ onTrue })} stepKeys={stepKeys} />
            </label>
            <label className="sop-field">
              <span>If false</span>
              <TransitionPicker value={(config.onFalse as Transition) ?? { then: 'FAIL' }} onChange={(onFalse) => set({ onFalse })} stepKeys={stepKeys} />
            </label>
          </div>
        </div>
      )
    case 'AUTOMATED_ACTION':
      return (
        <div className="sop-field">
          <span>Runs automatically</span>
          <ActionsEditor value={(config.actions as SopAction[]) ?? []} onChange={(actions) => set({ actions })} stepKeys={stepKeys} />
        </div>
      )
    case 'CONFIRMATION':
      return (
        <label className="sop-field">
          <span>Prompt</span>
          <input
            className="sop-input"
            value={String(config.prompt ?? '')}
            placeholder="I confirm the deployment is healthy"
            onChange={(e) => set({ prompt: e.target.value || undefined })}
          />
        </label>
      )
    default:
      return null
  }
}

/** Create or edit one SOP step. */
export function StepForm({
  step,
  stepKeys,
  busy,
  onSave,
  onCancel,
}: {
  step?: SopStep
  stepKeys: string[]
  busy: boolean
  onSave: (input: SopStepInput) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(step?.title ?? '')
  const [key, setKey] = useState(step?.key ?? '')
  const [type, setType] = useState<SopStepType>(step?.type ?? 'INSTRUCTION')
  const [description, setDescription] = useState(step?.description ?? '')
  const [command, setCommand] = useState(step?.command ?? '')
  const [requiresSignoff, setRequiresSignoff] = useState(step?.requiresSignoff ?? false)
  const [config, setConfig] = useState<Config>(step?.config ?? {})
  const [condition, setCondition] = useState<Condition | null>(step?.condition ?? null)
  const otherKeys = stepKeys.filter((k) => k !== step?.key)

  function submit() {
    const clean = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined))
    onSave({
      title: title.trim(),
      ...(key.trim() && { key: key.trim() }),
      type,
      description,
      command: command.trim() || null,
      requiresSignoff,
      config: clean,
      // Omitted on create when unset; explicitly cleared on edit.
      ...(condition || step ? { condition } : {}),
    })
  }

  return (
    <div className="step-form">
      <div className="sop-grid">
        <label className="sop-field grow">
          <span>Title</span>
          <input className="sop-input" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="QA Testing" />
        </label>
        <label className="sop-field">
          <span>Key</span>
          <input
            className="sop-input mono"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder={slug(title || 'from-title')}
            title="Used by conditions and rules, e.g. steps.qa-testing.result"
          />
        </label>
        <label className="sop-field">
          <span>Type</span>
          <select
            className="sop-select"
            value={type}
            onChange={(e) => {
              setType(e.target.value as SopStepType)
              setConfig({})
            }}
          >
            {STEP_TYPES.map((t) => (
              <option key={t} value={t}>
                {STEP_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">{STEP_TYPE_HINT[type]}</p>
      <label className="sop-field">
        <span>Description</span>
        <textarea className="sop-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="sop-grid">
        <label className="sop-field grow">
          <span>Command (optional)</span>
          <input className="sop-input mono" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="pnpm run deploy" />
        </label>
        <label className="sop-check">
          <input type="checkbox" checked={requiresSignoff} onChange={(e) => setRequiresSignoff(e.target.checked)} /> Requires sign-off notes
        </label>
      </div>
      <ConfigEditor key={type} type={type} config={config} onChange={setConfig} stepKeys={otherKeys} />
      <div className="sop-field">
        <span>Only run this step if… (otherwise it's skipped)</span>
        <ConditionEditor value={condition} onChange={setCondition} stepKeys={otherKeys} emptyLabel="Always runs." />
      </div>
      <div className="form-actions">
        <button type="button" className="text-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary-btn sm" disabled={busy || !title.trim()} onClick={submit}>
          {step ? 'Save step' : 'Add step'}
        </button>
      </div>
    </div>
  )
}
