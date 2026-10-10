import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createRule,
  createSop,
  createStep,
  deleteRule,
  deleteSop,
  deleteStep,
  getPublishInfo,
  publishSop,
  updateRule,
  updateSop,
  updateStep,
  type RuleInput,
  type Sop,
  type SopStepDef,
  type StepType,
} from '../../api/sops'
import { useConfirm } from '../../hooks/useConfirm'
import { sopKeys, useInvalidateSop, useSop, useSopList, useSopMeta } from '../../hooks/useSops'
import { describeCondition } from '../../lib/sopConditions'
import { LifeNoteLoader } from '../LifeNoteLoader'
import { defaultConfig, newRule, triggerLabel } from '../../lib/sopUi'
import { RuleEditor } from './RuleEditor'
import { StepEditor } from './StepEditor'
import './sop.css'

/** SOP library: list of SOP definitions plus the editor for the selected one. */
export function SopLibrary({ onClose }: { onClose: () => void }) {
  const { data: sops, isPending, error } = useSopList()
  const invalidate = useInvalidateSop()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const activeId = selectedId ?? sops?.[0]?.id ?? null

  return (
    <div className="issue sop-library">
      <header className="issue-top">
        <div className="issue-key-row">
          <span className="kind-chip kind-1">SOP Library</span>
          <span className="muted">Reusable workflows · assign them to modules or run them on any ticket</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="sop-library-body">
        <aside className="sop-list">
          <div className="section-head">
            <h4 className="section-label">SOPs</h4>
            <button type="button" className="accent-link" onClick={() => setCreating(true)}>
              + New
            </button>
          </div>
          {creating && (
            <form
              className="sop-new"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newTitle.trim()) return
                try {
                  const sop = await createSop(newTitle.trim())
                  invalidate()
                  setSelectedId(sop.id)
                  setNewTitle('')
                  setCreating(false)
                } catch (err) {
                  setCreateError((err as Error).message)
                }
              }}
            >
              <input
                autoFocus
                className="inline-input"
                value={newTitle}
                maxLength={200}
                placeholder="e.g. Backend Production Release"
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              />
              {createError && <p className="error small">{createError}</p>}
            </form>
          )}
          {isPending ? (
            <LifeNoteLoader size="sm" label="Loading SOPs…" />
          ) : error ? (
            <p className="error small">{(error as Error).message}</p>
          ) : sops?.length === 0 ? (
            <p className="muted small">No SOPs yet. Create one to define a reusable workflow.</p>
          ) : (
            sops?.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`sop-list-item${s.id === activeId ? ' selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="sop-list-title">{s.title}</span>
                <span className="muted small">
                  {s.publishedVersion ? `v${s.publishedVersion} published` : 'Draft'}
                  {s.publishedVersion !== null && s.publishedVersion !== s.version && ' · unpublished changes'}
                </span>
              </button>
            ))
          )}
        </aside>
        <section className="sop-editor-pane">
          {activeId ? (
            <SopEditor key={activeId} sopId={activeId} onDeleted={() => setSelectedId(null)} />
          ) : (
            <div className="main-empty">
              <h1>Executable SOPs</h1>
              <p className="empty-lead">
                An SOP is an ordered workflow of typed steps — checklists, approvals, testing, GitHub events, automated actions —
                with conditions and rules. Create one, publish it, then set it as a module's default so new tickets inherit it.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function SopEditor({ sopId, onDeleted }: { sopId: string; onDeleted: () => void }) {
  const { data: sop, error, isPending } = useSop(sopId)
  const { data: meta } = useSopMeta()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateSop()
  const confirm = useConfirm()
  const publishInfo = useQuery({ queryKey: sopKeys.publish(sopId), queryFn: () => getPublishInfo(sopId) })
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<string | 'new' | null>(null)
  const [newStepType, setNewStepType] = useState<StepType>('INSTRUCTION')
  const [newStepTitle, setNewStepTitle] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  if (isPending) return <LifeNoteLoader label="Opening SOP…" />
  if (error || !sop) return <p className="editor-msg error">{(error as Error)?.message ?? 'SOP not found'}</p>

  const steps = sop.steps
  const stepOptions = steps.map((s) => ({ key: s.key, title: `${s.position + 1}. ${s.title}` }))
  const refresh = () => {
    invalidate(sopId)
    queryClient.invalidateQueries({ queryKey: sopKeys.publish(sopId) })
  }
  async function act(fn: () => Promise<unknown>, ok?: string) {
    setMessage(null)
    try {
      await fn()
      refresh()
      if (ok) setMessage({ kind: 'ok', text: ok })
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
      throw e
    }
  }
  const problems = publishInfo.data?.problems ?? []

  return (
    <div className="sop-editor">
      <div className="sop-editor-head">
        <SopTitle sop={sop} onSave={(title, content) => act(() => updateSop(sop.id, { title, content }))} />
        <div className="publish-bar">
          <span className={`run-pill ${sop.hasUnpublishedChanges ? 'run-blocked' : 'run-completed'}`}>
            {sop.publishedVersion === null
              ? `Draft v${sop.version} · never published`
              : sop.hasUnpublishedChanges
                ? `Draft v${sop.version} · v${sop.publishedVersion} is live`
                : `v${sop.publishedVersion} published`}
          </span>
          <span className="muted small">
            {sop._count.assignments} module default{sop._count.assignments === 1 ? '' : 's'} · {sop._count.runbooks} run
            {sop._count.runbooks === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            className="primary-btn sm"
            disabled={!sop.hasUnpublishedChanges || problems.length > 0}
            title={problems.length ? 'Fix the problems below first' : 'New runs use the published version'}
            onClick={() => act(() => publishSop(sop.id), `Published v${sop.version}. New runs use it; running ones keep their version.`).catch(() => {})}
          >
            Publish v{sop.version}
          </button>
          <button
            type="button"
            className="text-btn sm danger"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete “${sop.title}”?`,
                message: 'Its steps, rules, versions and module defaults are deleted. Runbooks already running keep working from their own copy.',
                confirmLabel: 'Delete SOP',
                tone: 'danger',
              })
              if (ok) act(() => deleteSop(sop.id)).then(onDeleted, () => {})
            }}
          >
            Delete
          </button>
        </div>
        {message && <p className={`small ${message.kind === 'error' ? 'error' : 'ok-msg'}`}>{message.text}</p>}
        {problems.length > 0 && (
          <ul className="problems small">
            {problems.map((p) => (
              <li key={p}>⚠ {p}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">
          Steps <span className="count-chip">{steps.length}</span>
        </h3>
        <ol className="def-steps">
          {steps.map((step, i) => (
            <li key={step.id} className="def-step card">
              {editingStep === step.id ? (
                <StepEditor
                  step={step}
                  steps={stepOptions}
                  onCancel={() => setEditingStep(null)}
                  onSave={async (input) => {
                    await act(() => updateStep(sop.id, step.id, input))
                    setEditingStep(null)
                  }}
                />
              ) : (
                <StepSummary
                  step={step}
                  index={i}
                  last={i === steps.length - 1}
                  conditionText={step.condition ? describeCondition(step.condition, meta) : null}
                  onEdit={() => setEditingStep(step.id)}
                  onMove={(to) => act(() => updateStep(sop.id, step.id, { position: to })).catch(() => {})}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: `Delete step “${step.title}”?`,
                      message: 'Conditions or rules that point at this step will need updating before you can publish.',
                      confirmLabel: 'Delete step',
                      tone: 'danger',
                    })
                    if (ok) act(() => deleteStep(sop.id, step.id)).catch(() => {})
                  }}
                />
              )}
            </li>
          ))}
        </ol>
        <form
          className="add-step"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newStepTitle.trim()) return
            act(() => createStep(sop.id, { title: newStepTitle.trim(), type: newStepType, config: defaultConfig(newStepType) }))
              .then(() => setNewStepTitle(''))
              .catch(() => {})
          }}
        >
          <select className="sop-select sm" value={newStepType} onChange={(e) => setNewStepType(e.target.value as StepType)}>
            {meta?.stepTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="inline-input"
            value={newStepTitle}
            maxLength={200}
            placeholder="+ Add a step and press Enter"
            onChange={(e) => setNewStepTitle(e.target.value)}
          />
        </form>
      </div>

      <div className="section">
        <div className="section-head">
          <h3 className="section-title">
            Rules <span className="count-chip">{sop.rules.length}</span>
          </h3>
          <button type="button" className="accent-link" onClick={() => setEditingRule('new')}>
            + Rule
          </button>
        </div>
        <p className="muted small">React to what happens during a run — e.g. when QA fails, go back to development and notify the owner.</p>
        {sop.rules.map((rule) => (
          <div key={rule.id} className={`def-step card${rule.enabled ? '' : ' disabled'}`}>
            {editingRule === rule.id ? (
              <RuleEditor
                rule={rule}
                steps={stepOptions}
                onCancel={() => setEditingRule(null)}
                onSave={async (input: RuleInput) => {
                  await act(() => updateRule(sop.id, rule.id, input))
                  setEditingRule(null)
                }}
              />
            ) : (
              <div className="def-step-row">
                <div className="def-step-main">
                  <strong>{rule.name}</strong>
                  <span className="muted small">
                    When {triggerLabel(rule.trigger).toLowerCase()}
                    {rule.condition && ` and ${describeCondition(rule.condition, meta)}`} →{' '}
                    {rule.actions.map((a) => a.type.toLowerCase().replace(/_/g, ' ') + ('stepKey' in a ? ` ${a.stepKey}` : 'status' in a ? ` ${a.status}` : '')).join(', ')}
                    {!rule.enabled && ' · disabled'}
                  </span>
                </div>
                <div className="def-step-actions">
                  <button type="button" className="text-btn xs" onClick={() => setEditingRule(rule.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-btn xs danger"
                    onClick={async () => {
                      const ok = await confirm({ title: `Delete rule “${rule.name}”?`, confirmLabel: 'Delete rule', tone: 'danger' })
                      if (ok) act(() => deleteRule(sop.id, rule.id)).catch(() => {})
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {editingRule === 'new' && (
          <div className="def-step card">
            <RuleEditor
              rule={newRule(steps)}
              steps={stepOptions}
              onCancel={() => setEditingRule(null)}
              onSave={async (input) => {
                await act(() => createRule(sop.id, input))
                setEditingRule(null)
              }}
            />
          </div>
        )}
      </div>

      {publishInfo.data && publishInfo.data.versions.length > 0 && (
        <div className="section">
          <h4 className="section-label">Published versions</h4>
          <ul className="sop-audit">
            {publishInfo.data.versions.map((v) => (
              <li key={v.id}>
                <span className="sop-audit-at">v{v.version}</span>
                <span>
                  {new Date(v.createdAt).toLocaleString()} {v.publishedBy && `· ${v.publishedBy.name ?? v.publishedBy.email}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SopTitle({ sop, onSave }: { sop: Sop; onSave: (title: string, content: string) => Promise<unknown> }) {
  const [title, setTitle] = useState(sop.title)
  const [content, setContent] = useState(sop.content)
  const dirty = title !== sop.title || content !== sop.content
  return (
    <div className="sop-title-edit">
      <input className="issue-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        className="issue-desc"
        rows={2}
        value={content}
        placeholder="What this SOP is for, when to use it…"
        onChange={(e) => setContent(e.target.value)}
      />
      {dirty && (
        <div className="row-actions">
          <button type="button" className="primary-btn sm" disabled={!title.trim()} onClick={() => onSave(title.trim(), content).catch(() => {})}>
            Save
          </button>
          <button
            type="button"
            className="text-btn sm"
            onClick={() => {
              setTitle(sop.title)
              setContent(sop.content)
            }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}

function StepSummary({
  step,
  index,
  last,
  conditionText,
  onEdit,
  onMove,
  onDelete,
}: {
  step: SopStepDef
  index: number
  last: boolean
  conditionText: string | null
  onEdit: () => void
  onMove: (position: number) => void
  onDelete: () => void
}) {
  const { data: meta } = useSopMeta()
  const typeLabel = meta?.stepTypes.find((t) => t.type === step.type)?.label ?? step.type
  const config = step.config ?? {}
  const details = [
    step.type === 'APPROVAL' && `${config.requiredApprovals ?? 1} approval(s)`,
    step.type === 'CHECKLIST' && `${config.items?.length ?? 0} item(s)`,
    step.type === 'GITHUB_ACTION' && (config.event ?? 'callback'),
    step.type === 'AUTOMATED_ACTION' && (config.action ? config.action.type.toLowerCase().replace(/_/g, ' ') : 'external callback'),
    step.type === 'CONDITION' && config.check && `checks ${describeCondition(config.check, meta)}`,
    config.overrides?.length && `${config.overrides.length} conditional setting(s)`,
    config.mandatory && 'mandatory',
    step.requiresSignoff && 'sign-off',
  ].filter(Boolean)
  return (
    <div className="def-step-row">
      <span className="def-step-num">{index + 1}</span>
      <div className="def-step-main" onClick={onEdit}>
        <span>
          <strong>{step.title}</strong> <span className="type-chip">{typeLabel}</span> <code className="key-chip">{step.key}</code>
        </span>
        {(details.length > 0 || conditionText) && (
          <span className="muted small">
            {details.join(' · ')}
            {conditionText && `${details.length ? ' · ' : ''}only when ${conditionText}`}
          </span>
        )}
      </div>
      <div className="def-step-actions">
        <button type="button" className="ghost-icon" title="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}>
          ↑
        </button>
        <button type="button" className="ghost-icon" title="Move down" disabled={last} onClick={() => onMove(index + 1)}>
          ↓
        </button>
        <button type="button" className="text-btn xs" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="text-btn xs danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
