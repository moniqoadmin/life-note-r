import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmContext, type ConfirmOptions } from '../hooks/useConfirm'
import './confirm-dialog.css'

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/** Provides useConfirm() and renders the one confirmation modal the app needs. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open cancels the first.
        setPending((current) => {
          current?.resolve(false)
          return { ...options, resolve }
        })
      }),
    [],
  )

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && createPortal(<ConfirmDialog options={pending} onClose={close} />, document.body)}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const danger = options.tone === 'danger'

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Destructive dialogs start on Cancel so a stray Enter can't delete anything.
    ;(danger ? cancelRef : confirmRef).current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [danger])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose(false)
    }
    // Keep Tab inside the dialog.
    if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button')
      if (!focusable?.length) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div className="confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div
        ref={dialogRef}
        className={`confirm-dialog${danger ? ' danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? messageId : undefined}
        onKeyDown={onKeyDown}
      >
        <div className="confirm-head">
          {danger && (
            <span className="confirm-icon" aria-hidden="true">
              !
            </span>
          )}
          <h2 id={titleId}>{options.title}</h2>
        </div>
        {options.message && (
          <div id={messageId} className="confirm-message">
            {options.message}
          </div>
        )}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="confirm-cancel" onClick={() => onClose(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button ref={confirmRef} type="button" className="confirm-ok" onClick={() => onClose(true)}>
            {options.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
