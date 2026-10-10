import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CustomFieldValue, NotePatch } from '../../api/notes'
import {
  applyAssignment,
  createAssignment,
  deleteAssignment,
  listAssignments,
  updateAssignment,
  type Condition,
  type SopAssignment,
} from '../../api/sops'
import { useConfirm } from '../../hooks/useConfirm'
import { sopKeys, useNoteExecutions, useSopList, useSopMeta } from '../../hooks/useSops'
import { describeCondition } from '../../lib/sopConditions'
import { ConditionBuilder } from './ConditionBuilder'
import './sop.css'

/** "SOP" row for the details list: inherit (showing from where) or pin a specific SOP. */
export function SopOverrideSelect({
  noteId,
  sopOverrideId,
  onPatch,
}: {
  noteId: string
  sopOverrideId: string | null | undefined
  onPatch: (patch: NotePatch) => Promise<void>
}) {
  const { data: sops } = useSopList()
  const { data } = useNoteExecutions(noteId)
  const queryClient = useQueryClient()
  const inherited = data?.resolution && data.resolution.assignmentType === 'ENTITY_INHERITED' ? data.resolution : null

  return (
    <select
      className="prio-select sop-override"
      value={sopOverrideId ?? ''}
      title="Pin this ticket to one SOP, or inherit its module's default"
      onChange={async (e) => {
        await onPatch({ sopOverrideId: e.target.value || null })
        queryClient.invalidateQueries({ queryKey: sopKeys.noteExecutions(noteId) })
      }}
    >
      <option value="">{inherited ? `Inherit · ${inherited.sop?.title}` : sopOverrideId ? 'Inherit from module' : 'Inherit (none)'}</option>
      {sops?.map((s) => (
        <option key={s.id} value={s.id}>
          📌 {s.title}
        </option>
      ))}
    </select>
  )
}

/** Free-form custom fields, readable by SOP conditions as fields.<key>. */
export function CustomFieldsCard({
  noteId,
  fields,
  onPatch,
}: {
  noteId: string
  fields: Record<string, CustomFieldValue>
  onPatch: (patch: NotePatch) => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const entries = Object.entries(fields)
  const save = async (next: Record<string, CustomFieldValue>) => {
    await onPatch({ customFields: next })
    queryClient.invalidateQueries({ queryKey: sopKeys.noteExecutions(noteId) })
  }

  return (
    <div className="side-card">
      <h3>⚙ Custom fields</h3>
      <p className="muted small">SOP conditions read these as fields.&lt;name&gt; — e.g. riskLevel = HIGH.</p>
      {entries.map(([k, v]) => (
        <div key={k} className="kv field-row">
          <span className="mono">{k}</span>
          <span>
            {Array.isArray(v) ? v.join(', ') : String(v)}
            <button
              type="button"
              className="row-remove visible"
              aria-label={`Remove ${k}`}
              onClick={() => save(Object.fromEntries(entries.filter(([x]) => x !== k)))}
            >
              ×
            </button>
          </span>
        </div>
      ))}
      <form
        className="cf-form"
        onSubmit={(e) => {
          e.preventDefault()
          const name = key.trim()
          if (!name) return
          const parsed: CustomFieldValue =
            value === 'true' ? true : value === 'false' ? false : value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value
          save({ ...fields, [name]: parsed }).then(() => {
            setKey('')
            setValue('')
          })
        }}
      >
        <input
          className="label-input"
          value={key}
          placeholder="name"
          maxLength={64}
          onChange={(e) => setKey(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
        />
        <input className="label-input" value={value} placeholder="value" maxLength={500} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="label-add" disabled={!key.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}

const TICKETS_ONLY: Condition = { field: 'note.depth', operator: 'GREATER_THAN_OR_EQUAL', value: 2 }

/**
 * Entity-level defaults: which SOP tickets created anywhere under this note inherit.
 * Each default can be limited by a condition; the highest priority match wins.
 */
export function EntitySopDefaults({ noteId, kind }: { noteId: string; kind: string }) {
  const queryClient = useQueryClient()
  const { data: sops } = useSopList()
  const { data: meta } = useSopMeta()
  const key = sopKeys.assignments('NOTE', noteId)
  const { data: assignments, error } = useQuery({ queryKey: key, queryFn: () => listAssignments('NOTE', noteId) })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const confirm = useConfirm()

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  async function act(fn: () => Promise<unknown>, ok?: string) {
    setMessage(null)
    try {
      await fn()
      refresh()
      if (ok) setMessage(ok)
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="side-card">
      <h3>📘 Default SOP for items in this {kind.toLowerCase()}</h3>
      <p className="muted small">New tickets created under here inherit the first matching SOP. A ticket's own pinned SOP always wins.</p>
      {error && <p className="error small">{(error as Error).message}</p>}
      {assignments?.map((a) =>
        editing === a.id ? (
          <AssignmentForm
            key={a.id}
            initial={a}
            sops={sops ?? []}
            onCancel={() => setEditing(null)}
            onSave={(input) => act(() => updateAssignment(a.id, input)).then(() => setEditing(null))}
          />
        ) : (
          <div key={a.id} className="assignment">
            <div>
              <strong>{a.sop.title}</strong>
              <span className="muted small">
                {' '}
                · {a.condition ? describeCondition(a.condition, meta) : 'everything below'}
                {a.priority !== 0 && ` · priority ${a.priority}`}
              </span>
            </div>
            <div className="row-actions">
              <button type="button" className="text-btn xs" onClick={() => setEditing(a.id)}>
                Edit
              </button>
              <button
                type="button"
                className="text-btn xs"
                title="Re-resolve the SOP of tickets that already exist under here"
                onClick={() =>
                  act(async () => {
                    const r = await applyAssignment(a.id)
                    setMessage(`Checked ${r.checked} item(s); ${r.changed} now run a different SOP${r.failed ? `, ${r.failed} failed` : ''}.`)
                  })
                }
              >
                Apply to existing
              </button>
              <button
                type="button"
                className="text-btn xs danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remove “${a.sop.title}” as a default?`,
                    message: 'New tickets here stop inheriting it. Runbooks already running are not affected.',
                    confirmLabel: 'Remove',
                    tone: 'danger',
                  })
                  if (ok) act(() => deleteAssignment(a.id))
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ),
      )}
      {assignments?.length === 0 && !adding && <p className="muted small">None — tickets here inherit from further up, if anything.</p>}
      {adding ? (
        <AssignmentForm
          sops={sops ?? []}
          onCancel={() => setAdding(false)}
          onSave={(input) =>
            act(() => createAssignment({ ...input, scope: { type: 'NOTE', id: noteId } }), 'Saved. New tickets under here will run it.').then(() =>
              setAdding(false),
            )
          }
        />
      ) : (
        <button type="button" className="label-add" onClick={() => setAdding(true)} disabled={!sops?.length}>
          {sops?.length ? '+ Add default SOP' : 'Create an SOP in the SOP Library first'}
        </button>
      )}
      {message && <p className="small muted">{message}</p>}
    </div>
  )
}

function AssignmentForm({
  initial,
  sops,
  onSave,
  onCancel,
}: {
  initial?: SopAssignment
  sops: { id: string; title: string }[]
  onSave: (input: { sopId: string; condition: Condition | null; priority: number }) => Promise<void>
  onCancel: () => void
}) {
  const [sopId, setSopId] = useState(initial?.sopId ?? sops[0]?.id ?? '')
  const [condition, setCondition] = useState<Condition | null>(initial ? initial.condition : TICKETS_ONLY)
  const [priority, setPriority] = useState(initial?.priority ?? 0)
  return (
    <div className="assignment-form">
      <select className="sop-select sm" value={sopId} onChange={(e) => setSopId(e.target.value)}>
        {sops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <span className="muted small">Applies when (depth 2+ = tickets):</span>
      <ConditionBuilder value={condition} onChange={setCondition} emptyLabel="Everything below" />
      <label className="small inline-field">
        Priority
        <input className="sop-input sm" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} />
      </label>
      <div className="row-actions">
        <button type="button" className="primary-btn sm" disabled={!sopId} onClick={() => onSave({ sopId, condition, priority })}>
          Save
        </button>
        <button type="button" className="text-btn sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

