import { useEffect, useRef, useState } from 'react'
import { Send, ChevronRight, Wrench, CheckCircle2, XCircle, Brain } from 'lucide-react'
import { useOs, type ChatMessage, type ToolCall } from '@/os/OsContext'

function ToolCard({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false)
  const Icon = tool.status === 'done' ? CheckCircle2 : tool.status === 'error' ? XCircle : Wrench
  const color =
    tool.status === 'done'
      ? 'text-nexus-green'
      : tool.status === 'error'
        ? 'text-nexus-accent'
        : 'text-nexus-blue'
  return (
    <div className="my-1 rounded border border-nexus-line/20 bg-black/30 text-[11px] font-mono">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5"
      >
        <Icon size={12} className={`${color} ${tool.status === 'running' ? 'animate-pulse' : ''}`} />
        <span className="text-white">{tool.name}</span>
        <span className="text-nexus-line truncate flex-1">
          {tool.input && Object.keys(tool.input as object).length
            ? JSON.stringify(tool.input)
            : ''}
        </span>
        <ChevronRight size={12} className={`text-nexus-line transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && tool.result && (
        <pre className="px-2 pb-2 pt-0 text-[10px] text-nexus-dim whitespace-pre-wrap break-words max-h-40 overflow-auto scrollbar-thin">
          {tool.result}
        </pre>
      )}
    </div>
  )
}

function Message({ msg }: { msg: ChatMessage }) {
  const [showThinking, setShowThinking] = useState(false)
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-md text-[12px] leading-relaxed bg-white/10 text-white">
          {msg.text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className="w-[3px] self-stretch bg-nexus-accent rounded-full mr-2 shrink-0" />
      <div className="max-w-[88%] text-[12px] leading-relaxed text-nexus-dim font-mono">
        {msg.thinking && (
          <div className="mb-1">
            <button
              onClick={() => setShowThinking((s) => !s)}
              className="flex items-center gap-1 text-[10px] text-nexus-line hover:text-nexus-dim"
            >
              <Brain size={11} /> thinking {showThinking ? '▾' : '▸'}
            </button>
            {showThinking && (
              <pre className="mt-1 text-[10px] text-nexus-line/80 whitespace-pre-wrap break-words border-l border-nexus-line/20 pl-2">
                {msg.thinking}
              </pre>
            )}
          </div>
        )}
        {msg.tools.map((t) => (
          <ToolCard key={t.id} tool={t} />
        ))}
        <span className="whitespace-pre-wrap break-words">{msg.text}</span>
        {msg.pending && !msg.text && msg.tools.length === 0 && (
          <span className="text-nexus-line">
            working<span className="blink-cursor">_</span>
          </span>
        )}
        {msg.pending && msg.text && <span className="blink-cursor">▋</span>}
      </div>
    </div>
  )
}

export default function AgentTerminal() {
  const { messages, sendMessage, sending } = useOs()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const submit = () => {
    if (!input.trim() || sending) return
    sendMessage(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full bg-nexus-bg/80">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-nexus-line/20">
        <div className="w-2 h-2 rounded-full bg-nexus-green status-pulse" />
        <span className="text-[11px] text-nexus-dim tracking-tight">System Agent</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {messages.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
      </div>

      <div className="border-t border-nexus-line/20 p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder={sending ? 'Agent is working…' : 'Ask NEXUS to do something…'}
          className="flex-1 bg-white/5 border border-nexus-line/30 rounded-md px-3 py-2 text-[12px] text-white placeholder-nexus-line font-mono resize-none focus:outline-none focus:border-nexus-accent/50"
        />
        <button
          onClick={submit}
          disabled={sending || !input.trim()}
          className="p-2 bg-nexus-accent rounded-md text-white hover:bg-nexus-accent2 disabled:opacity-40 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
