// SVG chevron so it centres exactly; text glyphs like ⌄ and › sit at different heights per font.
export function ChevronIcon({ open = true, size = 14 }: { open?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', transform: open ? undefined : 'rotate(-90deg)', transition: 'transform .15s' }}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
