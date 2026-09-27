import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addComment,
  addCriterion,
  createNote,
  deleteComment,
  deleteCriterion,
  getNote,
  moveNote,
  updateCriterion,
  updateNote,
  type IssueStatus,
  type Note,
  type NotePatch,
} from '../../api/notes'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, issueKey } from '../../lib/issue'
import { ChevronIcon } from '../ChevronIcon'
import { LifeNoteLoader } from '../LifeNoteLoader'
import { SopRunbook } from './SopRunbook'
import './issue.css'

const kindOf = (depth: number) => (depth === 0 ? 'Module' : depth === 1 ? 'Sub-module' : 'Ticket')

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

// CSS classes are lower-case (st-in_progress, prio-urgent); API enums are upper-case.
const stClass = (s: IssueStatus) => `st-${s.toLowerCase()}`

function StatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`status-badge ${stClass(status)}`}>{STATUS_LABEL[status]}</span>
}

interface Crumb {
  id: string
  title: string
}

export function IssueDetail({
  noteId,
  depth,
  path,
  user,
  onSaved,
  onClose,
  onOpenChild,
  onOpenAncestor,
}: {
  noteId: string
  depth: number
  path: Crumb[]
  user: { id: string; name: string | null; email: string }
  onSaved: () => void
  onClose: () => void
  onOpenChild: (id: string, title: string) => void
  onOpenAncestor: (index: number) => void
}) {
  const userName = user.name ?? user.email
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [newCriterion, setNewCriterion] = useState('')
  const [newSubtask, setNewSubtask] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [copied, setCopied] = useState(false)
  const dirty = useRef(false)

  const load = useCallback(() => {
    let cancelled = false
    getNote(noteId)
      .then((n) => {
        if (cancelled) return
        setNote(n)
        if (!dirty.current) {
          setTitle(n.title)
          setContent(n.content)
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [noteId])

  useEffect(load, [load])

  // Debounced autosave for title and description.
  useEffect(() => {
    if (!dirty.current || !title.trim()) return
    const t = setTimeout(async () => {
      setSaveState('saving')
      try {
        const saved = await updateNote(noteId, { title: title.trim(), content })
        setNote((n) => (n ? { ...n, updatedAt: saved.updatedAt } : n))
        setSaveState('saved')
        onSaved()
      } catch (e) {
        setSaveState('error')
        setError((e as Error).message)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [title, content, noteId, onSaved])

  /** Applies `change` on screen right away, then persists it; rolls back if the request fails. */
  async function mutate(change: (n: Note) => Note, request: () => Promise<unknown>) {
    const before = note
    if (!before) return
    setNote(change(before))
    setSaveState('saving')
    try {
      await request()
      setSaveState('saved')
    } catch (e) {
      setNote(before)
      setSaveState('error')
      setError((e as Error).message)
    }
  }

  function patchIssue(patch: NotePatch) {
    return mutate(
      (n) => ({ ...n, ...patch }),
      async () => {
        const saved = await updateNote(noteId, patch)
        setNote((n) => (n ? { ...n, updatedAt: saved.updatedAt } : n))
      },
    )
  }

  async function createCriterion(text: string) {
    try {
      const created = await addCriterion(noteId, text)
      setNote((n) => (n ? { ...n, criteria: [...(n.criteria ?? []), created] } : n))
      setNewCriterion('')
    } catch (e) {
      setError((e as Error).message)
      setSaveState('error')
    }
  }

  async function postComment() {
    const body = comment.trim()
    if (!body) return
    setPosting(true)
    try {
      const created = await addComment(noteId, body)
      setNote((n) => (n ? { ...n, comments: [...(n.comments ?? []), created] } : n))
      setComment('')
    } catch (e) {
      setError((e as Error).message)
      setSaveState('error')
    } finally {
      setPosting(false)
    }
  }

  async function addSubtask(name: string) {
    try {
      await createNote(noteId, name)
      setNewSubtask(null)
      load()
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function copyLink() {
    navigator.clipboard
      ?.writeText(issueKey(noteId))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  const status = note?.status ?? 'TODO'
  const statusIdx = STATUSES.indexOf(status)
  const nextStatus = statusIdx < STATUSES.length - 2 ? STATUSES[statusIdx + 1] : null
  const children = note?.children ?? []
  const criteria = note?.criteria ?? []
  const comments = note?.comments ?? []
  const labels = note?.labels ?? []
  const doneChildren = children.filter((c) => c.status === 'DONE').length
  const criteriaDone = criteria.filter((c) => c.done).length
  const parentCrumb = path.at(-2)

  return (
    <div className="issue">
      <header className="issue-top">
        <div className="issue-key-row">
          <span className={`kind-chip kind-${Math.min(depth, 2)}`}>{kindOf(depth)}</span>
          {path.slice(0, -1).map((c, i) => (
            <span key={c.id} className="crumb-item">
              <button type="button" className="issue-parent" onClick={() => onOpenAncestor(i)}>
                {c.title}
              </button>
              <span className="muted">/</span>
            </span>
          ))}
          <span className="issue-key">{issueKey(noteId)}</span>
          <button type="button" className="ghost-icon" title="Copy issue key" onClick={copyLink}>
            {copied ? '✓' : '🔗'}
          </button>
        </div>
        <span className="issue-save">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'All changes saved'}
          {saveState === 'error' && <span className="error">{error}</span>}
        </span>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {error && !note ? (
        <p className="editor-msg error">{error}</p>
      ) : !note ? (
        <LifeNoteLoader label="Opening issue…" />
      ) : (
        <div className="issue-body">
          <section className="issue-main">
            <div className="status-row">
              <div className="status-picker">
                <button
                  type="button"
                  className={`status-btn ${stClass(status)}`}
                  onClick={() => setStatusOpen((o) => !o)}
                  onBlur={() => setTimeout(() => setStatusOpen(false), 150)}
                >
                  <span className="dot" /> {STATUS_LABEL[status].toUpperCase()} <ChevronIcon size={12} />
                </button>
                {statusOpen && (
                  <div className="status-menu">
                    {STATUSES.map((s) => (
                      <button type="button" key={s} onMouseDown={() => s !== status && patchIssue({ status: s })}>
                        <StatusBadge status={s} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {nextStatus && (
                <button type="button" className="pill-btn" onClick={() => patchIssue({ status: nextStatus })}>
                  Move to {STATUS_LABEL[nextStatus]} →
                </button>
              )}
              {status !== 'DONE' && (
                <button type="button" className="pill-btn" onClick={() => patchIssue({ status: 'DONE' })}>
                  ✓ Mark Done
                </button>
              )}
            </div>

            <div className="title-block">
              <div className="title-meta">
                <span className={`kind-chip kind-${Math.min(depth, 2)}`}>{kindOf(depth)}</span>
                <span className="muted">Updated {timeAgo(note.updatedAt)}</span>
              </div>
              <input
                className="issue-title"
                value={title}
                onChange={(e) => {
                  dirty.current = true
                  setTitle(e.target.value)
                }}
                placeholder="Untitled"
                maxLength={200}
              />
            </div>

            <div className="issue-toolbar">
              <button type="button" onClick={() => setNewSubtask('')}>
                ⊕ Add subtask
              </button>
              <button type="button" onClick={() => document.getElementById('criteria-input')?.focus()}>
                ☑ Add criterion
              </button>
              <button type="button" onClick={copyLink}>
                🔗 Copy key
              </button>
              {note.parentId && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await moveNote(noteId, null)
                      onSaved()
                      onClose()
                    } catch (e) {
                      setError((e as Error).message)
                    }
                  }}
                >
                  ↥ Move to top level
                </button>
              )}
            </div>

            <SopRunbook userEmail={user.email} />

            <div className="section">
              <h4 className="section-label">Description</h4>
              <textarea
                className="issue-desc"
                value={content}
                onChange={(e) => {
                  dirty.current = true
                  setContent(e.target.value)
                }}
                placeholder="Add a description…"
                rows={Math.max(5, content.split('\n').length + 1)}
              />
            </div>

            <div className="section">
              <h3 className="section-title">
                Acceptance Criteria
                {criteria.length > 0 && (
                  <span className="count-chip">
                    {criteriaDone} / {criteria.length}
                  </span>
                )}
              </h3>
              <div className="card checklist">
                {criteria.map((c) => (
                  <label key={c.id} className={`check-row${c.done ? ' done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={c.done}
                      onChange={() =>
                        mutate(
                          (n) => ({
                            ...n,
                            criteria: n.criteria?.map((x) => (x.id === c.id ? { ...x, done: !c.done } : x)),
                          }),
                          () => updateCriterion(noteId, c.id, { done: !c.done }),
                        )
                      }
                    />
                    <span>{c.text}</span>
                    <button
                      type="button"
                      className="row-remove"
                      aria-label="Remove criterion"
                      onClick={(e) => {
                        e.preventDefault()
                        mutate(
                          (n) => ({ ...n, criteria: n.criteria?.filter((x) => x.id !== c.id) }),
                          () => deleteCriterion(noteId, c.id),
                        )
                      }}
                    >
                      ×
                    </button>
                  </label>
                ))}
                <input
                  id="criteria-input"
                  className="inline-input"
                  value={newCriterion}
                  maxLength={500}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => {
                    const text = newCriterion.trim()
                    if (e.key === 'Enter' && text) createCriterion(text)
                  }}
                  placeholder="+ Add a criterion and press Enter"
                />
              </div>
            </div>

            <div className="section">
              <div className="section-head">
                <h3 className="section-title">
                  Sub-tasks
                  <span className="count-chip">
                    {doneChildren} / {children.length} done
                  </span>
                </h3>
                <button type="button" className="accent-link" onClick={() => setNewSubtask('')}>
                  + Create Subtask
                </button>
              </div>
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{ width: children.length ? `${(doneChildren / children.length) * 100}%` : 0 }}
                />
              </div>
              <div className="subtasks">
                {children.map((c) => {
                  const st = c.status ?? 'TODO'
                  return (
                    <button type="button" key={c.id} className="subtask" onClick={() => onOpenChild(c.id, c.title)}>
                      <span className={`sub-check ${stClass(st)}`}>{st === 'DONE' ? '✓' : st === 'TODO' ? '' : '⧗'}</span>
                      <span className="sub-key">{issueKey(c.id)}</span>
                      <span className={`sub-title${st === 'DONE' ? ' struck' : ''}`}>{c.title || 'Untitled'}</span>
                      <StatusBadge status={st} />
                    </button>
                  )
                })}
                {newSubtask !== null && (
                  <input
                    autoFocus
                    className="inline-input"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onBlur={() => !newSubtask.trim() && setNewSubtask(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setNewSubtask(null)
                      if (e.key === 'Enter' && newSubtask.trim()) addSubtask(newSubtask.trim())
                    }}
                    placeholder="Subtask title, then Enter"
                  />
                )}
                {children.length === 0 && newSubtask === null && <p className="muted small">No sub-tasks yet.</p>}
              </div>
            </div>

            <div className="section">
              <h3 className="section-title">
                Activity <span className="count-chip">Comments ({comments.length})</span>
              </h3>
              {comments.map((c) => {
                const author = c.author.name ?? c.author.email
                return (
                  <div key={c.id} className="comment">
                    <span className="av">{initials(author)}</span>
                    <div className="comment-card">
                      <div className="comment-head">
                        <strong>{author}</strong>
                        <span className="muted">• {timeAgo(c.createdAt)}</span>
                        {c.authorId === user.id && (
                          <button
                            type="button"
                            className="row-remove"
                            aria-label="Delete comment"
                            onClick={() =>
                              mutate(
                                (n) => ({ ...n, comments: n.comments?.filter((x) => x.id !== c.id) }),
                                () => deleteComment(noteId, c.id),
                              )
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <p>{c.body}</p>
                    </div>
                  </div>
                )
              })}
              <div className="comment">
                <span className="av">{initials(userName)}</span>
                <div className="comment-box">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment()
                    }}
                    placeholder="Add a comment…"
                    rows={3}
                    maxLength={10_000}
                  />
                  <div className="comment-actions">
                    <span className="muted small">Ctrl+Enter to post</span>
                    <button type="button" className="text-btn" onClick={() => setComment('')} disabled={!comment}>
                      Cancel
                    </button>
                    <button type="button" className="primary-btn" disabled={!comment.trim() || posting} onClick={postComment}>
                      {posting ? 'Posting…' : 'Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="issue-side">
            <h4 className="section-label">Issue Details</h4>
            <dl className="details">
              <dt>Assignee</dt>
              <dd>
                <span className="av sm">{initials(userName)}</span> {userName} <span className="muted">(you)</span>
              </dd>
              <dt>Reporter</dt>
              <dd>
                <span className="av sm">{initials(userName)}</span> {userName}
              </dd>
              <dt>Priority</dt>
              <dd>
                <select
                  className={`prio-select prio-${note.priority.toLowerCase()}`}
                  value={note.priority}
                  onChange={(e) => patchIssue({ priority: e.target.value as Note['priority'] })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </dd>
              {parentCrumb && (
                <>
                  <dt>Parent</dt>
                  <dd>
                    <span className="epic-chip">● {parentCrumb.title}</span>
                  </dd>
                </>
              )}
              <dt>Labels</dt>
              <dd className="labels">
                {labels.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className="label-chip"
                    title="Remove label"
                    onClick={() => patchIssue({ labels: labels.filter((x) => x !== l) })}
                  >
                    {l}
                  </button>
                ))}
                {newLabel === null ? (
                  labels.length < 20 && (
                    <button type="button" className="label-add" onClick={() => setNewLabel('')}>
                      + Add label
                    </button>
                  )
                ) : (
                  <input
                    autoFocus
                    className="label-input"
                    value={newLabel}
                    maxLength={40}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onBlur={() => setNewLabel(null)}
                    onKeyDown={(e) => {
                      const l = newLabel.trim()
                      if (e.key === 'Escape') setNewLabel(null)
                      if (e.key === 'Enter' && l) {
                        if (!labels.some((x) => x.toLowerCase() === l.toLowerCase())) patchIssue({ labels: [...labels, l] })
                        setNewLabel(null)
                      }
                    }}
                  />
                )}
              </dd>
            </dl>

            <div className="side-card">
              <h3>⏱ Dates</h3>
              <div className="kv">
                <span>Created</span>
                <span>{formatDate(note.createdAt)}</span>
              </div>
              <div className="kv">
                <span>Updated</span>
                <span>{timeAgo(note.updatedAt)}</span>
              </div>
            </div>

            <div className="side-card">
              <h3>☑ Progress</h3>
              <div className="kv">
                <span>Criteria</span>
                <span>
                  {criteriaDone} / {criteria.length}
                </span>
              </div>
              <div className="kv">
                <span>Sub-tasks</span>
                <span>
                  {doneChildren} / {children.length}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
