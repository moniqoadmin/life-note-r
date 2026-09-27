import './life-note-loader.css'

type Size = 'sm' | 'md' | 'lg'

const PX: Record<Size, number> = { sm: 18, md: 48, lg: 72 }

/**
 * Animated Life Note mark: the note outline draws itself, the corner folds, then the "L" is written.
 * `fullscreen` centres it on the dashboard background for page-level loads.
 */
export function LifeNoteLoader({
  size = 'md',
  label,
  fullscreen = false,
}: {
  size?: Size
  label?: string
  fullscreen?: boolean
}) {
  const px = PX[size]
  const mark = (
    <svg className="ln-mark" width={px} height={px} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        className="ln-body"
        pathLength={100}
        d="M16 6H40L52 18V54Q52 58 48 58H16Q12 58 12 54V10Q12 6 16 6Z"
      />
      <path className="ln-fold" pathLength={100} d="M40 6V18H52" />
      <path className="ln-letter" pathLength={100} d="M25 21V43H39" />
    </svg>
  )

  return (
    <div
      className={`ln-loader ln-${size}${fullscreen ? ' ln-fullscreen' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
    >
      {mark}
      {size === 'lg' && <span className="ln-wordmark">Life Note</span>}
      {label && <span className="ln-label">{label}</span>}
    </div>
  )
}
