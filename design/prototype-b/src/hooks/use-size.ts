import { useEffect, useState, type RefObject } from "react"

export function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 390, height: 844 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
