import { useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type Snap = "half" | "full"

interface BottomPanelProps {
  snap: Snap
  onSnapChange?: (snap: Snap) => void
  halfTop: number
  fullTop: number
  label: string
  children: ReactNode
  footer?: ReactNode
  headerRight?: ReactNode
  className?: string
}

/**
 * Inline (non-modal) bottom sheet with two snap points. Lives inside the phone screen instead of
 * portalling to <body>, so it stays inside the desktop phone frame. Drag the grabber or tap it.
 */
export function BottomPanel({
  snap,
  onSnapChange,
  halfTop,
  fullTop,
  label,
  children,
  footer,
  headerRight,
  className,
}: BottomPanelProps) {
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ y: number; top: number; moved: boolean } | null>(null)
  const top = drag ?? (snap === "full" ? fullTop : halfTop)
  const canToggle = !!onSnapChange && halfTop !== fullTop

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canToggle) return
    start.current = { y: e.clientY, top, moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const dy = e.clientY - start.current.y
    if (Math.abs(dy) > 4) start.current.moved = true
    if (start.current.moved) setDrag(Math.min(halfTop + 40, Math.max(fullTop, start.current.top + dy)))
  }
  const onPointerUp = () => {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.moved) {
      setDrag(null)
      onSnapChange?.(snap === "full" ? "half" : "full")
      return
    }
    const cur = drag ?? s.top
    setDrag(null)
    onSnapChange?.(cur < (halfTop + fullTop) / 2 ? "full" : "half")
  }

  return (
    <section
      aria-label={label}
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-(--radius-sheet) bg-card shadow-sheet",
        drag === null && "transition-[top] duration-[420ms] ease-(--ease-out-soft)",
        className,
      )}
      style={{ top }}
    >
      <div className="relative z-20 flex h-6 shrink-0 items-center justify-center">
        {canToggle ? (
          <button
            type="button"
            aria-label={snap === "full" ? "Zwiń arkusz" : "Rozwiń arkusz"}
            aria-expanded={snap === "full"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSnapChange?.(snap === "full" ? "half" : "full")
              }
            }}
            className="absolute inset-x-24 -top-2 flex h-10 touch-none items-center justify-center rounded-full"
          >
            <span className="h-1 w-9 rounded-full bg-border-strong/70" />
          </button>
        ) : (
          <span aria-hidden className="h-1 w-9 rounded-full bg-border-strong/70" />
        )}
        {headerRight ? <div className="absolute top-2 right-3">{headerRight}</div> : null}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
      {footer}
    </section>
  )
}
