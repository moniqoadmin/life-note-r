import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { createNote, deleteNote, listNotes, type NoteSummary, type SearchHit } from '../api/notes'
import { ChevronIcon } from '../components/ChevronIcon'
import { CommandBar, type Command } from '../components/CommandBar'
import { IssueDetail } from '../components/issue/IssueDetail'
import { LifeNoteLoader } from '../components/LifeNoteLoader'
import { useLogout, useSession } from '../hooks/useAuth'
import './dashboard.css'

// The backend only has notes; the tree depth decides what a note is called in the UI.
const kindOf = (depth: number) => (depth === 0 ? 'Module' : depth === 1 ? 'Sub-module' : 'Ticket')

// Placeholders for views that don't exist yet; shown disabled so the nav reads like the target design.
const PLANNING_LINKS = [
  { icon: '▦', label: 'Kanban Board' },
  { icon: '☰', label: 'Backlog & Sprints' },
  { icon: '↗', label: 'Roadmap / Timeline' },
]

function sortByTitle(notes: NoteSummary[]) {
  return [...notes].sort((a, b) => a.title.localeCompare(b.title))
}

interface Crumb {
  id: string
  title: string
}

interface Selection {
  id: string
  depth: number
  path: Crumb[]
}

function initial(user: { name: string | null; email: string }) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

interface TreeActions {
  selectedId: string | null
  refreshKey: number
  onSelect: (selection: Selection) => void
  onCreate: (parentId: string, depth: number, path: Crumb[]) => Promise<void>
  onDelete: (note: NoteSummary) => void
}

function TreeRow({
  note,
  depth,
  ancestors,
  actions,
}: {
  note: NoteSummary
  depth: number
  ancestors: Crumb[]
  actions: TreeActions
}) {
  const { selectedId, refreshKey, onSelect, onCreate, onDelete } = actions
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<NoteSummary[] | null>(null)
  const path = [...ancestors, { id: note.id, title: note.title || 'Untitled' }]

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
      <div
        className={`tree-row${selectedId === note.id ? ' selected' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onSelect({ id: note.id, depth, path })}
      >
        {depth === 0 ? (
          <span className={`tree-dot${open || selectedId === note.id ? ' active' : ''}`} aria-hidden="true" />
        ) : (
          <span className="tree-hash" aria-hidden="true">
            #
          </span>
        )}
        <span className="tree-title">{note.title || 'Untitled'}</span>
        <span className="tree-actions">
          <button
            type="button"
            title={`Add ${kindOf(depth + 1).toLowerCase()}`}
            onClick={async (e) => {
              e.stopPropagation()
              setOpen(true)
              await onCreate(note.id, depth + 1, path)
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
          <ChevronIcon open={open} />
        </button>
      </div>
      {open &&
        children &&
        sortByTitle(children).map((c) => (
          <TreeRow key={c.id} note={c} depth={depth + 1} ancestors={path} actions={actions} />
        ))}
    </>
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

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (isPending) return <LifeNoteLoader size="lg" fullscreen />
  if (!user) return <Navigate to="/login" replace />

  async function handleCreate(parentId: string | null, depth = 0, path: Crumb[] = []) {
    try {
      const note = await createNote(parentId, kindOf(depth))
      setSelected({ id: note.id, depth, path: [...path, { id: note.id, title: note.title }] })
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Creates directly under whatever is currently open, or at the top level otherwise.
  async function handleCreateFromSearch(title: string) {
    try {
      const parentId = selected?.id ?? null
      const depth = selected ? selected.depth + 1 : 0
      const path = selected?.path ?? []
      const note = await createNote(parentId, title)
      setSelected({ id: note.id, depth, path: [...path, { id: note.id, title: note.title }] })
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

  function selectHit(h: SearchHit) {
    setSelected({
      id: h.id,
      depth: h.breadcrumb.length,
      path: [...h.breadcrumb, { id: h.id, title: h.title || 'Untitled' }],
    })
  }

  async function createTopLevel(title: string) {
    try {
      const note = await createNote(null, title)
      setSelected({ id: note.id, depth: 0, path: [{ id: note.id, title: note.title }] })
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function signOut() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') })
  }

  const openTitle = selected?.path.at(-1)?.title
  const commands = (q: string): Command[] =>
    q
      ? [
          ...(selected
            ? [{ id: 'create-in', icon: '+', label: `Create “${q}” in ${openTitle}`, hint: 'Enter', run: handleCreateFromSearch }]
            : []),
          { id: 'create-module', icon: '▤', label: `Create module “${q}”`, run: createTopLevel },
        ]
      : [
          { id: 'new-module', icon: '▤', label: 'New module', run: () => handleCreate(null) },
          ...(selected
            ? [
                {
                  id: 'new-child',
                  icon: '+',
                  label: `New ${kindOf(selected.depth + 1).toLowerCase()} in ${openTitle}`,
                  run: () => handleCreate(selected.id, selected.depth + 1, selected.path),
                },
                { id: 'close', icon: '×', label: `Close ${openTitle}`, run: () => setSelected(null) },
              ]
            : []),
          { id: 'sign-out', icon: '⎋', label: 'Sign out', run: signOut },
        ]

  const actions: TreeActions = {
    selectedId,
    refreshKey,
    onSelect: setSelected,
    onCreate: handleCreate,
    onDelete: handleDelete,
  }

  return (
    <div className="jira">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo sm">L</span>
          <div className="sidebar-brand-wrap">
            <span className="sidebar-brand">Life Note</span>
            <span className="sidebar-workspace">
              <span className="ws-dot" /> {user.name ? `${user.name}'s workspace` : 'Personal workspace'}
            </span>
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-section">
            <div className="section-heading">Planning</div>
            {PLANNING_LINKS.map((l) => (
              <button type="button" key={l.label} className="nav-item" disabled title="Coming soon">
                <span className="nav-icon" aria-hidden="true">
                  {l.icon}
                </span>
                {l.label}
                <span className="soon">Soon</span>
              </button>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="section-heading">
              Workspace Modules
              <button type="button" className="section-add" title="New module" onClick={() => handleCreate(null)}>
                +
              </button>
            </div>

            {error && <p className="banner error">{error}</p>}

            <nav className="sidebar-tree">
              {roots === null ? (
                <LifeNoteLoader size="sm" label="Loading modules…" />
              ) : roots.length === 0 ? (
                <p className="tree-empty">No modules yet.</p>
              ) : (
                sortByTitle(roots).map((n) => <TreeRow key={n.id} note={n} depth={0} ancestors={[]} actions={actions} />)
              )}
            </nav>
          </div>
        </div>

        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">
            {initial(user)}
          </span>
          <div className="footer-user">
            <span className="footer-name">{user.name ?? user.email}</span>
            <span className="footer-email">{user.email}</span>
          </div>
          <button type="button" className="footer-icon" aria-label="Account settings" onClick={() => setMenuOpen((o) => !o)}>
            ⚙
          </button>
          {menuOpen && (
            <div className="menu menu-up">
              <div className="menu-user">{user.name ?? user.email}</div>
              <div className="menu-email">{user.email}</div>
              <button
                type="button"
                onClick={signOut}
                disabled={logout.isPending}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        {selected ? (
          <IssueDetail
            key={selected.id}
            noteId={selected.id}
            depth={selected.depth}
            path={selected.path}
            user={user}
            onSaved={refresh}
            onClose={() => setSelected(null)}
            onOpenAncestor={(i) => setSelected({ id: selected.path[i]!.id, depth: i, path: selected.path.slice(0, i + 1) })}
            onOpenChild={(id, title) =>
              setSelected({ id, depth: selected.depth + 1, path: [...selected.path, { id, title: title || 'Untitled' }] })
            }
          />
        ) : (
          <div className="main-empty">
            {roots?.length === 0 ? (
              <>
                <h1>Start your first module</h1>
                <p className="empty-lead">
                  Modules hold your work. Name one in the search bar below and press Enter, or start with a blank one.
                </p>
                <button type="button" className="empty-cta" onClick={() => handleCreate(null)}>
                  + New module
                </button>
              </>
            ) : (
              <>
                <h1>Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
                <p className="empty-lead">
                  Pick a module or ticket from the sidebar, or use the search bar below to find anything.
                </p>
              </>
            )}
            <ul className="empty-tips">
              <li>
                <kbd>⌘K</kbd>
                <span>Jump to search from anywhere</span>
              </li>
              <li>
                <kbd>Enter</kbd>
                <span>Type a name, then pick <em>Create</em> to add it</span>
              </li>
              <li>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <span>Move through results</span>
              </li>
              <li>
                <kbd>Esc</kbd>
                <span>Close search</span>
              </li>
            </ul>
          </div>
        )}
        <CommandBar commands={commands} onSelectHit={selectHit} />
      </main>
    </div>
  )
}
