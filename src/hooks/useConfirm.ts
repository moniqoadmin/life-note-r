import { createContext, useContext, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  /** Label of the confirming button, e.g. "Delete". */
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` styles the confirm button red (deletes, resets). */
  tone?: 'danger' | 'default'
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Promise-based replacement for window.confirm, rendered as the app's own modal:
 *   if (!(await confirm({ title: 'Delete note?', confirmLabel: 'Delete', tone: 'danger' }))) return
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return confirm
}
