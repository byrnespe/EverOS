import { useEffect } from 'react'
import { OsProvider, useOs, type AppId } from '@/os/OsContext'
import NebulaField from '@/components/NebulaField'
import AgentOrb from '@/components/AgentOrb'
import TopBar from '@/components/TopBar'
import TaskBar from '@/components/TaskBar'
import WindowFrame from '@/components/WindowFrame'
import AgentTerminal from '@/apps/AgentTerminal'
import FileExplorer from '@/apps/FileExplorer'
import SystemMonitor from '@/apps/SystemMonitor'
import ToolActivity from '@/apps/ToolActivity'

interface AppDef {
  id: AppId
  title: string
  node: React.ReactNode
  geo: { x: number; y: number; w: number; h: number }
}

function appDefs(vw: number, vh: number): AppDef[] {
  return [
    {
      id: 'terminal',
      title: 'Agent Terminal',
      node: <AgentTerminal />,
      geo: { x: vw - 440, y: 56, w: 400, h: vh - 150 },
    },
    {
      id: 'files',
      title: 'Files — workspace',
      node: <FileExplorer />,
      geo: { x: 48, y: 120, w: 520, h: 360 },
    },
    {
      id: 'monitor',
      title: 'System Monitor',
      node: <SystemMonitor />,
      geo: { x: 48, y: vh - 360, w: 440, h: 280 },
    },
    {
      id: 'activity',
      title: 'Tool Activity',
      node: <ToolActivity />,
      geo: { x: vw / 2 - 200, y: vh - 340, w: 420, h: 280 },
    },
  ]
}

function Desktop() {
  const { windows, agentState, openWindow } = useOs()
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const defs = appDefs(vw, vh)

  useEffect(() => {
    const t = setTimeout(() => openWindow('terminal'), 150)
    return () => clearTimeout(t)
  }, [openWindow])

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <NebulaField />

      {/* Ambient agent presence — always visible, reacts to real agent state. */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[5]"
        style={{ width: 380, height: 380, opacity: 0.9 }}
      >
        <AgentOrb state={agentState} />
      </div>

      <TopBar />
      <TaskBar />

      <div className="absolute inset-0" style={{ top: 32, bottom: 48, zIndex: 10 }}>
        {defs.map((def) =>
          windows.some((w) => w.id === def.id) ? (
            <WindowFrame
              key={def.id}
              id={def.id}
              title={def.title}
              defaultX={def.geo.x}
              defaultY={def.geo.y}
              defaultWidth={def.geo.w}
              defaultHeight={def.geo.h}
            >
              {def.node}
            </WindowFrame>
          ) : null,
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <OsProvider>
      <Desktop />
    </OsProvider>
  )
}
