import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { X, Minus, Maximize2 } from 'lucide-react'
import { useOs, type AppId } from '@/os/OsContext'

interface WindowFrameProps {
  id: AppId
  title: string
  defaultX: number
  defaultY: number
  defaultWidth: number
  defaultHeight: number
  children: ReactNode
}

type Snap = 'none' | 'left' | 'right' | 'full'

const TOP = 32
const BOTTOM = 48

export default function WindowFrame({
  id,
  title,
  defaultX,
  defaultY,
  defaultWidth,
  defaultHeight,
  children,
}: WindowFrameProps) {
  const { windows, focusWindow, closeWindow, minimizeWindow } = useOs()

  // All hooks run unconditionally — no early return before this point.
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const [pos, setPos] = useState({ x: defaultX, y: defaultY })
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight })
  const [snap, setSnap] = useState<Snap>('none')
  const [prev, setPrev] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      focusWindow(id)
      drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [focusWindow, id, pos.x, pos.y],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.sx
    const dy = e.clientY - drag.current.sy
    setPos({ x: drag.current.ox + dx, y: drag.current.oy + dy })
    const t = 20
    if (e.clientY < t) setSnap('full')
    else if (e.clientX < t) setSnap('left')
    else if (e.clientX > window.innerWidth - t) setSnap('right')
    else setSnap('none')
  }, [])

  const onPointerUp = useCallback(() => {
    if (!drag.current) return
    drag.current = null
    if (snap === 'none') return
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPrev({ x: pos.x, y: pos.y, w: size.w, h: size.h })
    if (snap === 'full') {
      setPos({ x: 0, y: TOP }); setSize({ w: vw, h: vh - TOP - BOTTOM })
    } else if (snap === 'left') {
      setPos({ x: 0, y: TOP }); setSize({ w: vw / 2, h: vh - TOP - BOTTOM })
    } else if (snap === 'right') {
      setPos({ x: vw / 2, y: TOP }); setSize({ w: vw / 2, h: vh - TOP - BOTTOM })
    }
    setSnap('none')
  }, [snap, pos, size])

  const toggleMax = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxed = size.w >= vw - 1 && Math.abs(size.h - (vh - TOP - BOTTOM)) < 2
    if (maxed && prev) {
      setPos({ x: prev.x, y: prev.y }); setSize({ w: prev.w, h: prev.h }); setPrev(null)
    } else {
      setPrev({ x: pos.x, y: pos.y, w: size.w, h: size.h })
      setPos({ x: 0, y: TOP }); setSize({ w: vw, h: vh - TOP - BOTTOM })
    }
  }, [size, pos, prev])

  useEffect(() => {
    const onResize = () => {
      setSize((s) => ({
        w: Math.min(s.w, window.innerWidth),
        h: Math.min(s.h, window.innerHeight - TOP - BOTTOM),
      }))
      setPos((p) => ({
        x: Math.min(p.x, Math.max(0, window.innerWidth - 120)),
        y: Math.min(p.y, Math.max(TOP, window.innerHeight - BOTTOM - 40)),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const state = windows.find((w) => w.id === id)
  if (!state || state.minimized) return null

  return (
    <div
      className="window-panel absolute flex flex-col shadow-2xl shadow-black/40"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: state.zIndex }}
      onPointerDown={() => focusWindow(id)}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-nexus-panel border-b border-nexus-line/20 cursor-move select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="text-[11px] font-medium text-nexus-dim tracking-tight">{title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => minimizeWindow(id)}
            className="p-0.5 rounded text-nexus-line hover:text-white hover:bg-white/5"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={toggleMax}
            className="p-0.5 rounded text-nexus-line hover:text-white hover:bg-white/5"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={() => closeWindow(id)}
            className="p-0.5 rounded text-nexus-line hover:text-white hover:bg-nexus-accent"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-nexus-bg/80">{children}</div>

      {snap !== 'none' && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-nexus-accent/40 rounded-md" />
      )}
    </div>
  )
}
