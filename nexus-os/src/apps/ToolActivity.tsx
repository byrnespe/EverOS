import { Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useOs } from '@/os/OsContext'

/** A live ledger of every real tool call the agent has made this session. */
export default function ToolActivity() {
  const { toolLog } = useOs()

  return (
    <div className="flex flex-col h-full bg-nexus-bg/80">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-nexus-line/20">
        <Wrench size={12} className="text-nexus-dim" />
        <span className="text-[11px] text-nexus-dim tracking-tight">Tool Activity</span>
        <span className="ml-auto text-[10px] text-nexus-line font-mono">{toolLog.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {toolLog.length === 0 && (
          <div className="p-3 text-[11px] text-nexus-line font-mono">
            No tools called yet. Every real tool the agent runs shows up here.
          </div>
        )}
        {toolLog.map((t) => {
          const Icon =
            t.status === 'done' ? CheckCircle2 : t.status === 'error' ? XCircle : Loader2
          const color =
            t.status === 'done'
              ? 'text-nexus-green'
              : t.status === 'error'
                ? 'text-nexus-accent'
                : 'text-nexus-blue'
          return (
            <div key={t.id} className="px-3 py-2 border-b border-nexus-line/10 font-mono">
              <div className="flex items-center gap-2 text-[12px]">
                <Icon size={12} className={`${color} ${t.status === 'running' ? 'animate-spin' : ''}`} />
                <span className="text-white">{t.name}</span>
                <span className="ml-auto text-[9px] text-nexus-line">
                  {new Date(t.at).toLocaleTimeString('en-US', { hour12: false })}
                </span>
              </div>
              {t.input != null && Object.keys(t.input as object).length > 0 && (
                <div className="text-[10px] text-nexus-line mt-0.5 truncate">
                  {JSON.stringify(t.input)}
                </div>
              )}
              {t.result && (
                <pre className="text-[10px] text-nexus-dim/70 mt-1 whitespace-pre-wrap break-words max-h-24 overflow-auto scrollbar-thin">
                  {t.result}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
