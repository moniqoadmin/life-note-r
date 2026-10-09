import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { updateNote } from '../../api/notes'
import { sopKeys, useNoteSop, useSops } from '../../hooks/useSops'

/**
 * Sidebar card for a note's SOP: which one applies and why (its own override, or
 * inherited from the nearest module that sets a default), plus the default this note
 * passes on to tickets created inside it.
 */
export function SopAssignment({ noteId, kind }: { noteId: string; kind: string }) {
  const qc = useQueryClient()
  const resolution = useNoteSop(noteId)
  const sops = useSops()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const data = resolution.data
  const assignment = data?.assignment
  const overrideId = assignment?.assignmentType === 'TASK_OVERRIDE' ? assignment.sop.id : ''

  async function save(patch: { sopOverrideId?: string | null; defaultSopId?: string | null }) {
    setSaving(true)
    setError(null)
    try {
      await updateNote(noteId, patch)
      await Promise.all([
        qc.invalidateQueries({ queryKey: sopKeys.noteSop(noteId) }),
        qc.invalidateQueries({ queryKey: sopKeys.noteRuns(noteId) }),
      ])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const options = (sops.data ?? []).map((s) => (
    <option key={s.id} value={s.id}>
      {s.title}
    </option>
  ))

  return (
    <div className="side-card sop-assign-card">
      <h3>
        📘 SOP <Link to="/sops" className="accent-link small">Library →</Link>
      </h3>
      {resolution.isPending ? (
        <p className="muted small">Loading…</p>
      ) : (
        <>
          <div className="kv">
            <span>Applies</span>
            <span>
              {assignment ? (
                <>
                  {assignment.sop.title}{' '}
                  <span className="sop-assign">
                    {assignment.assignmentType === 'TASK_OVERRIDE'
                      ? 'Own'
                      : `From ${assignment.source?.title ?? 'parent'}`}
                  </span>
                </>
              ) : (
                <span className="muted">None</span>
              )}
            </span>
          </div>
          <label className="sop-field">
            <span>Use SOP for this {kind.toLowerCase()}</span>
            <select
              className="sop-select"
              value={overrideId}
              disabled={saving}
              onChange={(e) => save({ sopOverrideId: e.target.value || null })}
            >
              <option value="">{assignment?.assignmentType === 'ENTITY_INHERITED' ? '— Inherit from parent —' : '— None —'}</option>
              {options}
            </select>
          </label>
          <label className="sop-field">
            <span>Default for new items inside</span>
            <select
              className="sop-select"
              value={data?.defaultSop?.id ?? ''}
              disabled={saving}
              onChange={(e) => save({ defaultSopId: e.target.value || null })}
            >
              <option value="">— None —</option>
              {options}
            </select>
          </label>
          <p className="muted small">
            Changing the SOP here cancels the current run and starts the new one. A default only applies to tickets
            created afterwards.
          </p>
        </>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
