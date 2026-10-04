import { useEffect, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Snapshot {
  cpu: number
  memory: number
  load1: number
  cores: number
  memUsedGb: number
  memTotalGb: number
  uptimeH: number
}

interface Point {
  t: string
  cpu: number
  memory: number
}

/** Polls /api/system for REAL host metrics and keeps a rolling 60-point buffer. */
export default function SystemMonitor() {
  const [data, setData] = useState<Point[]>([])
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/system')
        const s: Snapshot = await res.json()
        setSnap(s)
        const t = new Date().toLocaleTimeString('en-US', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        })
        setData((prev) => [...prev, { t, cpu: s.cpu, memory: s.memory }].slice(-60))
      } catch {
        // backend not reachable yet
      }
    }
    poll()
    timer.current = setInterval(poll, 1500)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-nexus-bg/80">
      <div className="flex items-center justify-between px-3 py-2 border-b border-nexus-line/20">
        <span className="text-[11px] text-nexus-dim tracking-tight font-medium">System Health (live host)</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-nexus-line">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-nexus-accent" /> CPU
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-nexus-blue" /> MEM
          </span>
        </div>
      </div>

      <div className="flex-1 p-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fe523d" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#fe523d" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="memG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#555' }} tickLine={false} axisLine={{ stroke: '#333' }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#555' }} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: '#111', border: '1px solid #555', borderRadius: 4, fontSize: 10 }}
              labelStyle={{ color: '#a1a1a1', fontSize: 9 }}
            />
            <Area type="monotone" dataKey="cpu" stroke="#fe523d" strokeWidth={1.5} fill="url(#cpuG)" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="memory" stroke="#3b82f6" strokeWidth={1.5} fill="url(#memG)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {snap && (
        <div className="grid grid-cols-3 gap-px bg-nexus-line/10 border-t border-nexus-line/20 text-[10px] font-mono">
          <Stat label="CPU" value={`${snap.cpu}%`} />
          <Stat label="LOAD" value={`${snap.load1}`} />
          <Stat label="CORES" value={`${snap.cores}`} />
          <Stat label="MEM" value={`${snap.memUsedGb}/${snap.memTotalGb}G`} />
          <Stat label="MEM%" value={`${snap.memory}%`} />
          <Stat label="UPTIME" value={`${snap.uptimeH}h`} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-nexus-bg px-2 py-1.5">
      <div className="text-nexus-line text-[8px] uppercase tracking-wider">{label}</div>
      <div className="text-white">{value}</div>
    </div>
  )
}
