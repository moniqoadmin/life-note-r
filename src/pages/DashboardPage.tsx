import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  moveNote,
  searchNotes,
  updateNote,
  type Note,
  type NoteSummary,
  type SearchHit,
} from '../api/notes'
import { useLogout, useSession } from '../hooks/useAuth'
import './dashboard.css'

type SortKey = 'updatedAt' | 'createdAt' | 'title'

// ts_headline wraps matches in <b> tags; show them as plain text.
const stripTags = (s: string) => s.replace(/<[^>]*>/g, '')

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

function sortNotes(notes: NoteSummary[], key: SortKey) {
  return [...notes].sort((a, b) =>
    key === 'title' ? a.title.localeCompare(b.title) : b[key].localeCompare(a[key]),
  )
}

// The backend only has notes; the tree depth decides what a note is called in the UI.
const kindOf = (depth: number) => (depth === 0 ? 'Module' : depth === 1 ? 'Sub-module' : 'Ticket')
const iconOf = (depth: number) => (depth === 0 ? '▤' : depth === 1 ? '▦' : '✓')

interface Selection {
  id: string
  depth: number
}

function initial(user: { name: string | null; email: string }) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

interface RowActions {
  selectedId: string | null
  refreshKey: number
  sort: SortKey
  onSelect: (selection: Selection) => void
  onCreate: (parentId: string, depth: number) => Promise<void>
  onDelete: (note: NoteSummary) => void
}

function NoteRow({ note, depth, actions }: { note: NoteSummary; depth: number; actions: RowActions }) {
  const { selectedId, refreshKey, sort, onSelect, onCreate, onDelete } = actions
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<NoteSummary[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    listNotes(note.id)
      .then((n) => !cancelled && setChildren(n))
      .catch(() => !cancelled && setChildren([]))
    return () => {
      cancelled = true
    }
  }, [open, refreshKey, note.id])

  const hasChildren = (note.childCount ?? 0) > 0 || (children?.length ?? 0) > 0

  return (
    <>
      <div className={`row${selectedId === note.id ? ' selected' : ''}`} onClick={() => onSelect({ id: note.id, depth })}>
        <div className="cell cell-work" style={{ paddingLeft: 12 + depth * 22 }}>
          <button
            type="button"
            className="chevron"
            aria-label={open ? 'Collapse' : 'Expand'}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
          >
            {open ? '⌄' : '›'}
          </button>
          <span className={`note-icon kind-${Math.min(depth, 2)}`} aria-hidden="true">
            {iconOf(depth)}
          </span>
          <span className="note-title">{note.title || 'Untitled'}</span>
          <span className="row-actions">
            <button
              type="button"
              title={`Add ${kindOf(depth + 1).toLowerCase()}`}
              onClick={async (e) => {
                e.stopPropagation()
                setOpen(true)
                await onCreate(note.id, depth + 1)
              }}
            >
              +
            </button>
            <button
              type="button"
              title="Delete"
              className="danger"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(note)
              }}
            >
              ×
            </button>
          </span>
        </div>
        <div className="cell">{kindOf(depth)}</div>
        <div className="cell cell-num">
          {note.childCount ? <span className="pill">{note.childCount}</span> : <span className="muted">None</span>}
        </div>
        <div className="cell">{formatDate(note.createdAt)}</div>
        <div className="cell">{formatDate(note.updatedAt)}</div>
      </div>
      {open &&
        children &&
        sortNotes(children, sort).map((c) => <NoteRow key={c.id} note={c} depth={depth + 1} actions={actions} />)}
    </>
  )
}

function Editor({
  noteId,
  depth,
  onSaved,
  onClose,
  onOpen,
}: {
  noteId: string
  depth: number
  onSaved: () => void
  onClose: () => void
  onOpen: (selection: Selection) => void
}) {
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const dirty = useRef(false)

  useEffect(() => {
    let cancelled = false
    getNote(noteId)
      .then((n) => {
        if (cancelled) return
        setNote(n)
        setTitle(n.title)
        setContent(n.content)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [noteId])

  // Debounced autosave.
  useEffect(() => {
    if (!dirty.current || !title.trim()) return
    const t = setTimeout(async () => {
      setState('saving')
      try {
        await updateNote(noteId, { title: title.trim(), content })
        setState('saved')
        onSaved()
      } catch (e) {
        setState('error')
        setError((e as Error).message)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [title, content, noteId, onSaved])

  return (
    <aside className="panel">
      <div className="panel-head">
        <span className="panel-kind">{kindOf(depth)}</span>
        <span className="panel-status">
          {state === 'saving' && 'Saving…'}
          {state === 'saved' && 'All changes saved'}
          {state === 'error' && <span className="error">{error}</span>}
          {state === 'idle' && note && `Last edited ${formatDate(note.updatedAt)}`}
        </span>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {error && !note ? (
        <p className="panel-msg error">{error}</p>
      ) : !note ? (
        <p className="panel-msg">Loading…</p>
      ) : (
        <div className="panel-body">
          <input
            className="editor-title"
            value={title}
            onChange={(e) => {
              dirty.current = true
              setTitle(e.target.value)
            }}
            placeholder="Untitled"
            maxLength={200}
          />
          <textarea
            className="editor-body"
            value={content}
            onChange={(e) => {
              dirty.current = true
              setContent(e.target.value)
            }}
            placeholder="Start writing…"
          />
          {note.parentId && (
            <button
              type="button"
              className="link-btn"
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
              Move to top level
            </button>
          )}
          {note.children && note.children.length > 0 && (
            <div className="children">
              <h3>{kindOf(depth + 1)}s</h3>
              {note.children.map((c) => (
                <button key={c.id} type="button" onClick={() => onOpen({ id: c.id, depth: depth + 1 })}>
                  <span className={`note-icon kind-${Math.min(depth + 1, 2)}`}>{iconOf(depth + 1)}</span>{' '}
                  {c.title || 'Untitled'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: user, isPending } = useSession()
  const logout = useLogout()

  const [roots, setRoots] = useState<NoteSummary[] | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const selectedId = selected?.id ?? null
  const [refreshKey, setRefreshKey] = useState(0)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [sort, setSort] = useState<SortKey>('updatedAt')
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signedIn = Boolean(user)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    listNotes()
      .then((n) => !cancelled && setRoots(n))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [refreshKey, signedIn])

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const t = setTimeout(() => {
      searchNotes(q)
        .then((r) => !cancelled && setHits(r))
        .catch(() => !cancelled && setHits([]))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (isPending) return <p className="dash-loading">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  const shownHits = query.trim() ? hits : null

  async function handleCreate(parentId: string | null, depth = 0) {
    try {
      const note = await createNote(parentId, kindOf(depth))
      setSelected({ id: note.id, depth })
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(note: NoteSummary) {
    const extra = note.childCount ? ' and all of its sub-notes' : ''
    if (!window.confirm(`Delete "${note.title || 'Untitled'}"${extra}?`)) return
    try {
      await deleteNote(note.id)
      if (selectedId === note.id) setSelected(null)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const actions: RowActions = {
    selectedId,
    refreshKey,
    sort,
    onSelect: setSelected,
    onCreate: handleCreate,
    onDelete: handleDelete,
  }

  return (
    <div className="jira">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="logo">L</span>
          <span>Life Note</span>
        </div>
        <button type="button" className="btn-create" onClick={() => handleCreate(null)}>
          + Create
        </button>
        <div className="topbar-spacer" />
        <div className="avatar-wrap">
          <button
            type="button"
            className="avatar"
            aria-label="Account menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {initial(user)}
          </button>
          {menuOpen && (
            <div className="menu">
              <div className="menu-user">{user.name ?? user.email}</div>
              <div className="menu-email">{user.email}</div>
              <button
                type="button"
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
                disabled={logout.isPending}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="workspace">
        <section className="content">
          <div className="crumb">Spaces</div>
          <h1 className="space-title">
            <span className="logo sm">N</span> My Workspace
          </h1>
          <nav className="tabs">
            <span className="tab active">▤ List</span>
          </nav>

          <div className="toolbar">
            <input
              type="search"
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search work"
            />
            <label className="sort">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="updatedAt">Updated</option>
                <option value="createdAt">Created</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>

          {error && <p className="banner error">{error}</p>}

          <div className="table">
            <div className="row head">
              <div className="cell cell-work">Work</div>
              <div className="cell">Type</div>
              <div className="cell cell-num">Items</div>
              <div className="cell">Created</div>
              <div className="cell">Updated</div>
            </div>
            <div className="table-body">
              {shownHits ? (
                shownHits.length === 0 ? (
                  <p className="empty">No results.</p>
                ) : (
                  shownHits.map((h) => (
                    <div
                      key={h.id}
                      className={`row${selectedId === h.id ? ' selected' : ''}`}
                      onClick={() => setSelected({ id: h.id, depth: h.breadcrumb.length })}
                    >
                      <div className="cell cell-work hit">
                        <span className={`note-icon kind-${Math.min(h.breadcrumb.length, 2)}`} aria-hidden="true">
                          {iconOf(h.breadcrumb.length)}
                        </span>
                        <span className="note-title">{h.title || 'Untitled'}</span>
                        <span className="muted hit-snippet">
                          {h.breadcrumb.length > 0 && `${h.breadcrumb.map((b) => b.title).join(' › ')} — `}
                          {stripTags(h.snippet)}
                        </span>
                      </div>
                    </div>
                  ))
                )
              ) : roots === null ? (
                <p className="empty">Loading…</p>
              ) : roots.length === 0 ? (
                <p className="empty">No notes yet. Create your first one.</p>
              ) : (
                sortNotes(roots, sort).map((n) => <NoteRow key={n.id} note={n} depth={0} actions={actions} />)
              )}
            </div>
            <div className="table-foot">
              <button type="button" className="foot-create" onClick={() => handleCreate(null)}>
                + Create
              </button>
              <span className="count">
                {shownHits ? `${shownHits.length} result${shownHits.length === 1 ? '' : 's'}` : `${roots?.length ?? 0} of ${roots?.length ?? 0}`}
              </span>
              <button type="button" className="icon-btn" title="Refresh" aria-label="Refresh" onClick={refresh}>
                ↻
              </button>
            </div>
          </div>
        </section>

        {selected && (
          <Editor
            key={selected.id}
            noteId={selected.id}
            depth={selected.depth}
            onSaved={refresh}
            onClose={() => setSelected(null)}
            onOpen={setSelected}
          />
        )}
      </div>
    </div>
  )
}
