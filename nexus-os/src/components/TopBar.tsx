import { Activity, Cpu } from 'lucide-react'
import { useOs } from '@/os/OsContext'

const STATE_LABEL: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  tool: 'Running tool',
  responding: 'Responding',
}

export default function TopBar() {
  const { clock, windows, agentState, mode, model } = useOs()
  const active = windows.filter((w) => !w.minimized).length

  return (
    <div className="fixed top-0 inset-x-0 h-[32px] bg-nexus-panel border-b border-nexus-line/30 flex items-center justify-between px-3 z-[100]">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold tracking-tight text-nexus-accent">NEXUS</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wide ${
            mode === 'live'
              ? 'bg-nexus-green/15 text-nexus-green'
              : mode === 'simulated'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-nexus-line/15 text-nexus-dim'
          }`}
          title={model ? `model: ${model}` : 'connecting…'}
        >
          {mode === 'unknown' ? '…' : mode}
        </span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Activity size={12} className="text-nexus-green" />
        <span className="text-[11px] text-nexus-dim font-mono tracking-tight">
          {STATE_LABEL[agentState] ?? agentState} — {active} window{active === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Cpu size={12} className="text-nexus-dim" />
        <span className="text-[11px] text-nexus-dim font-mono">{clock}</span>
      </div>
    </div>
  )
}
