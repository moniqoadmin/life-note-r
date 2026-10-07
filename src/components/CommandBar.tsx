import { useEffect, useMemo, useRef, useState } from 'react'
import { searchNotes, type SearchHit } from '../api/notes'
import './command-bar.css'

export interface Command {
  id: string
  label: string
  hint?: string
  icon: string
  run: (query: string) => void
}

type Item = { kind: 'command'; command: Command } | { kind: 'hit'; hit: SearchHit }

// Minimal typing for the (still prefixed in Chrome/Safari) Web Speech API.
interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition
const SpeechRecognition: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
    .SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition

export function CommandBar({
  commands,
  onSelectHit,
}: {
  /** Commands receive the typed query; ones that need text are hidden while it's empty. */
  commands: (query: string) => Command[]
  onSelectHit: (hit: SearchHit) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)

  // ⌘K / Ctrl+K focuses the bar from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setHits(null)
      setSearchError(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      searchNotes(q)
        .then((r) => {
          if (cancelled) return
          setHits(r)
          setSearchError(null)
        })
        .catch((e: Error) => {
          if (cancelled) return
          setHits([])
          setSearchError(e.message)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const q = query.trim()
  const items = useMemo<Item[]>(() => {
    const cmds = commands(q).map((command) => ({ kind: 'command' as const, command }))
    const found = (hits ?? []).map((hit) => ({ kind: 'hit' as const, hit }))
    // With text typed, matching issues come first; commands follow.
    return q ? [...found, ...cmds] : cmds
  }, [commands, hits, q])

  useEffect(() => setActive(0), [q, hits])

  function close() {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  function choose(item: Item | undefined) {
    if (!item) return
    if (item.kind === 'hit') onSelectHit(item.hit)
    else item.command.run(q)
    close()
  }

  function toggleVoice() {
    if (!SpeechRecognition) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = true
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? '')
        .join('')
      setQuery(text)
      setOpen(true)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
    inputRef.current?.focus()
  }

  const hitItems = items.filter((i) => i.kind === 'hit')
  const cmdItems = items.filter((i) => i.kind === 'command')

  return (
    <div className="cmdbar-wrap">
      {open && (
        <div className="cmdbar-panel" onMouseDown={(e) => e.preventDefault()}>
          {q && (
            <div className="cmdbar-group">
              <div className="cmdbar-group-label">Issues</div>
              {searchError ? (
                <div className="cmdbar-empty error">Search failed: {searchError}</div>
              ) : hits === null ? (
                <div className="cmdbar-empty">Searching…</div>
              ) : hitItems.length === 0 ? (
                <div className="cmdbar-empty">No issues match “{q}”</div>
              ) : (
                hitItems.map((item) => {
                  const idx = items.indexOf(item)
                  const { hit } = item as Extract<Item, { kind: 'hit' }>
                  return (
                    <button
                      type="button"
                      key={hit.id}
                      className={`cmdbar-item${idx === active ? ' active' : ''}`}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(item)}
                    >
                      <span className="cmdbar-icon">#</span>
                      <span className="cmdbar-text">
                        <span className="cmdbar-title">{hit.title || 'Untitled'}</span>
                        {hit.breadcrumb.length > 0 && (
                          <span className="cmdbar-sub">{hit.breadcrumb.map((b) => b.title).join(' › ')}</span>
                        )}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          )}
          {cmdItems.length > 0 && (
            <div className="cmdbar-group">
              <div className="cmdbar-group-label">Commands</div>
              {cmdItems.map((item) => {
                const idx = items.indexOf(item)
                const { command } = item as Extract<Item, { kind: 'command' }>
                return (
                  <button
                    type="button"
                    key={command.id}
                    className={`cmdbar-item${idx === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(item)}
                  >
                    <span className="cmdbar-icon">{command.icon}</span>
                    <span className="cmdbar-text">
                      <span className="cmdbar-title">{command.label}</span>
                    </span>
                    {command.hint && <span className="cmdbar-hint">{command.hint}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className={`cmdbar${open ? ' focused' : ''}`}>
        <span className="cmdbar-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, items.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(items[active])
            }
          }}
          placeholder={listening ? 'Listening…' : 'Search issues, comments, or commands…'}
          aria-label="Search issues or run a command"
        />
        {SpeechRecognition && (
          <button
            type="button"
            className={`cmdbar-mic${listening ? ' on' : ''}`}
            aria-label={listening ? 'Stop voice input' : 'Search by voice'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleVoice}
          >
            🎙
          </button>
        )}
        <kbd>⌘K</kbd>
        <span className="cmdbar-or">or</span>
        <kbd>Esc</kbd>
      </div>
    </div>
  )
}
