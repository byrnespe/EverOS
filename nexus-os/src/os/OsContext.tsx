import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AgentState } from './protocol'
import { streamAgent } from './useAgentClient'

export type AppId = 'terminal' | 'files' | 'monitor' | 'activity'

export interface WindowState {
  id: AppId
  zIndex: number
  minimized: boolean
}

export interface ToolCall {
  id: string
  name: string
  input: unknown
  status: 'running' | 'done' | 'error'
  result?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  thinking?: string
  tools: ToolCall[]
  pending?: boolean
}

export interface ToolLogEntry extends ToolCall {
  at: number
}

interface OsContextValue {
  windows: WindowState[]
  activeWindow: AppId | null
  openWindow: (id: AppId) => void
  closeWindow: (id: AppId) => void
  focusWindow: (id: AppId) => void
  minimizeWindow: (id: AppId) => void
  isOpen: (id: AppId) => boolean

  clock: string
  agentState: AgentState
  mode: 'live' | 'simulated' | 'unknown'
  model: string

  messages: ChatMessage[]
  toolLog: ToolLogEntry[]
  sending: boolean
  sendMessage: (text: string) => void
}

const OsContext = createContext<OsContextValue | null>(null)

let idCounter = 0
const nextId = () => `m${Date.now().toString(36)}_${idCounter++}`

const SESSION_ID = 'desktop-' + Math.random().toString(36).slice(2, 8)

export function OsProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([])
  const [activeWindow, setActiveWindow] = useState<AppId | null>(null)
  const [clock, setClock] = useState('')
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [mode, setMode] = useState<'live' | 'simulated' | 'unknown'>('unknown')
  const [model, setModel] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      text: 'NEXUS online. I run this desktop — ask me to inspect the system, work with files, or open a window.',
      tools: [],
    },
  ])
  const [toolLog, setToolLog] = useState<ToolLogEntry[]>([])
  const [sending, setSending] = useState(false)
  const zRef = useRef(100)

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const openWindow = useCallback((id: AppId) => {
    setActiveWindow(id)
    setWindows((prev) => {
      zRef.current += 1
      const existing = prev.find((w) => w.id === id)
      if (existing) {
        return prev.map((w) =>
          w.id === id ? { ...w, minimized: false, zIndex: zRef.current } : w,
        )
      }
      return [...prev, { id, zIndex: zRef.current, minimized: false }]
    })
  }, [])

  const closeWindow = useCallback((id: AppId) => {
    setWindows((prev) => prev.filter((w) => w.id !== id))
    setActiveWindow((cur) => (cur === id ? null : cur))
  }, [])

  const focusWindow = useCallback((id: AppId) => {
    setActiveWindow(id)
    setWindows((prev) => {
      zRef.current += 1
      return prev.map((w) => (w.id === id ? { ...w, zIndex: zRef.current } : w))
    })
  }, [])

  const minimizeWindow = useCallback((id: AppId) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
  }, [])

  const isOpen = useCallback(
    (id: AppId) => windows.some((w) => w.id === id && !w.minimized),
    [windows],
  )

  // --- update helpers for the in-flight agent message -----------------------
  const patchAgentMsg = useCallback(
    (msgId: string, fn: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? fn(m) : m)))
    },
    [],
  )

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      const userMsg: ChatMessage = { id: nextId(), role: 'user', text: trimmed, tools: [] }
      const agentId = nextId()
      const agentMsg: ChatMessage = { id: agentId, role: 'agent', text: '', tools: [], pending: true }
      setMessages((prev) => [...prev, userMsg, agentMsg])
      setSending(true)
      setAgentState('thinking')

      streamAgent({ sessionId: SESSION_ID, message: trimmed }, (event) => {
        switch (event.type) {
          case 'meta':
            setMode(event.mode)
            setModel(event.model)
            break
          case 'status':
            setAgentState(event.state)
            break
          case 'thinking':
            patchAgentMsg(agentId, (m) => ({ ...m, thinking: (m.thinking ?? '') + event.text }))
            break
          case 'token':
            patchAgentMsg(agentId, (m) => ({ ...m, text: m.text + event.text }))
            break
          case 'tool_use': {
            const call: ToolCall = {
              id: event.id,
              name: event.name,
              input: event.input,
              status: 'running',
            }
            patchAgentMsg(agentId, (m) => ({ ...m, tools: [...m.tools, call] }))
            setToolLog((prev) => [{ ...call, at: Date.now() }, ...prev].slice(0, 50))
            break
          }
          case 'tool_result': {
            patchAgentMsg(agentId, (m) => ({
              ...m,
              tools: m.tools.map((t) =>
                t.id === event.id
                  ? { ...t, status: event.isError ? 'error' : 'done', result: event.content }
                  : t,
              ),
            }))
            setToolLog((prev) =>
              prev.map((t) =>
                t.id === event.id
                  ? { ...t, status: event.isError ? 'error' : 'done', result: event.content }
                  : t,
              ),
            )
            break
          }
          case 'ui_action':
            if (event.action.type === 'open_app') openWindow(event.action.appId as AppId)
            else closeWindow(event.action.appId as AppId)
            break
          case 'error':
            patchAgentMsg(agentId, (m) => ({
              ...m,
              text: m.text + `\n[error: ${event.message}]`,
            }))
            break
          case 'done':
            patchAgentMsg(agentId, (m) => ({ ...m, pending: false }))
            break
        }
      })
        .catch((e: unknown) => {
          patchAgentMsg(agentId, (m) => ({
            ...m,
            text: m.text || `Connection error: ${(e as Error).message}`,
            pending: false,
          }))
        })
        .finally(() => {
          setSending(false)
          setAgentState('idle')
        })
    },
    [sending, patchAgentMsg, openWindow, closeWindow],
  )

  const value = useMemo<OsContextValue>(
    () => ({
      windows,
      activeWindow,
      openWindow,
      closeWindow,
      focusWindow,
      minimizeWindow,
      isOpen,
      clock,
      agentState,
      mode,
      model,
      messages,
      toolLog,
      sending,
      sendMessage,
    }),
    [
      windows,
      activeWindow,
      openWindow,
      closeWindow,
      focusWindow,
      minimizeWindow,
      isOpen,
      clock,
      agentState,
      mode,
      model,
      messages,
      toolLog,
      sending,
      sendMessage,
    ],
  )

  return <OsContext.Provider value={value}>{children}</OsContext.Provider>
}

export function useOs(): OsContextValue {
  const ctx = useContext(OsContext)
  if (!ctx) throw new Error('useOs must be used within OsProvider')
  return ctx
}
