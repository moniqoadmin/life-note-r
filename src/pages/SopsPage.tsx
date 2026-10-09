import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { createSop } from '../api/sops'
import { LifeNoteLoader } from '../components/LifeNoteLoader'
import { SopEditor } from '../components/sop/SopEditor'
import { useSession } from '../hooks/useAuth'
import { sopKeys, useSops } from '../hooks/useSops'
import { createBackendReleaseSop } from '../lib/sop-templates'
import './dashboard.css'
import '../components/issue/issue.css'
import '../components/sop/sop.css'

/** SOP library: list of reusable SOP definitions and the editor for the selected one. */
export function SopsPage() {
  const { sopId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: user, isPending } = useSession()
  const sops = useSops()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isPending) return <LifeNoteLoader size="lg" fullscreen />
  if (!user) return <Navigate to="/login" replace />

  async function create(make: () => Promise<{ id: string }>) {
    setBusy(true)
    setError(null)
    try {
      const sop = await make()
      await qc.invalidateQueries({ queryKey: sopKeys.all })
      setTitle('')
      navigate(`/sops/${sop.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const list = sops.data ?? []

  return (
    <div className="jira sops-page">
      <aside className="sops-side">
        <Link to="/dashboard" className="accent-link small">
          ← Back to workspace
        </Link>
        <h2>SOP Library</h2>
        <p className="muted small">Reusable procedures. Assign one to a ticket, or set it as a module's default.</p>
        <div className="sop-new">
          <input
            className="sop-input"
            value={title}
            maxLength={200}
            placeholder="New SOP title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && title.trim() && create(() => createSop({ title: title.trim() }))}
          />
          <button type="button" className="primary-btn sm" disabled={busy || !title.trim()} onClick={() => create(() => createSop({ title: title.trim() }))}>
            Create
          </button>
        </div>
        <button type="button" className="pill-btn sm" disabled={busy} onClick={() => create(createBackendReleaseSop)}>
          {busy ? 'Creating…' : '＋ From template: Backend Production Release'}
        </button>
        {error && <p className="error small">{error}</p>}
        <nav className="sops-list">
          {sops.isPending ? (
            <LifeNoteLoader size="sm" label="Loading…" />
          ) : list.length === 0 ? (
            <p className="muted small">No SOPs yet.</p>
          ) : (
            list.map((s) => (
              <Link key={s.id} to={`/sops/${s.id}`} className={`sops-item${s.id === sopId ? ' on' : ''}`}>
                <span>{s.title}</span>
                <span className="muted small">v{s.version}</span>
              </Link>
            ))
          )}
        </nav>
      </aside>
      <main className="sops-main">
        {sopId ? (
          <SopEditor key={sopId} sopId={sopId} onDeleted={() => navigate('/sops')} />
        ) : (
          <div className="main-empty">
            <h1>Standard Operating Procedures</h1>
            <p className="empty-lead">
              Pick an SOP on the left, create one, or start from the Backend Production Release template. Steps can be
              checklists, approvals, tests, GitHub events, conditions or automated actions; rules react to what happens
              during a run.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
