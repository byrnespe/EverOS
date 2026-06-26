import { Terminal, FolderOpen, Gauge, ListTree, type LucideIcon } from 'lucide-react'
import { useOs, type AppId } from '@/os/OsContext'

const APPS: { id: AppId; title: string; icon: LucideIcon }[] = [
  { id: 'terminal', title: 'Agent Terminal', icon: Terminal },
  { id: 'files', title: 'Files', icon: FolderOpen },
  { id: 'monitor', title: 'System Monitor', icon: Gauge },
  { id: 'activity', title: 'Tool Activity', icon: ListTree },
]

export default function TaskBar() {
  const { openWindow, isOpen, agentState } = useOs()
  const busy = agentState !== 'idle'

  return (
    <div className="fixed bottom-0 inset-x-0 h-[48px] bg-nexus-panel border-t border-nexus-line/30 flex items-center justify-center gap-1 px-4 z-[100]">
      {APPS.map((app) => {
        const Icon = app.icon
        const open = isOpen(app.id)
        return (
          <button
            key={app.id}
            onClick={() => openWindow(app.id)}
            title={app.title}
            className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors ${
              open ? 'bg-white/5 text-nexus-accent' : 'text-nexus-dim hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={18} />
          </button>
        )
      })}

      <button
        onClick={() => openWindow('terminal')}
        title="Invoke Agent"
        className={`mx-3 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-nexus-accent to-nexus-accent2 text-white shadow-lg shadow-nexus-accent/20 transition-transform ${
          busy ? 'scale-110 animate-pulse' : 'hover:scale-105'
        }`}
      >
        <span className="text-[13px] font-bold">AI</span>
      </button>
    </div>
  )
}
