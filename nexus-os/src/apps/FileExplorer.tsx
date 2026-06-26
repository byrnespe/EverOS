import { useCallback, useEffect, useState } from 'react'
import { Folder, FileText, RefreshCw, ArrowLeft } from 'lucide-react'

interface Entry {
  name: string
  dir: boolean
}

export default function FileExplorer() {
  const [path, setPath] = useState('.')
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async (p: string) => {
    setError('')
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(p)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'failed')
      setEntries(data.entries)
    } catch (e) {
      setError((e as Error).message)
      setEntries([])
    }
  }, [])

  useEffect(() => {
    load(path)
  }, [path, load])

  const openEntry = async (e: Entry) => {
    if (e.dir) {
      setSelected(null)
      setContent('')
      setPath(path === '.' ? e.name : `${path}/${e.name}`)
      return
    }
    const rel = path === '.' ? e.name : `${path}/${e.name}`
    setSelected(rel)
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(rel)}`)
      const data = await res.json()
      setContent(res.ok ? data.content : data.error)
    } catch (err) {
      setContent((err as Error).message)
    }
  }

  const up = () => {
    if (path === '.') return
    const parts = path.split('/')
    parts.pop()
    setPath(parts.length ? parts.join('/') : '.')
    setSelected(null)
    setContent('')
  }

  return (
    <div className="flex flex-col h-full bg-nexus-bg/80">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-nexus-line/20">
        <button onClick={up} disabled={path === '.'} className="text-nexus-line hover:text-white disabled:opacity-30">
          <ArrowLeft size={13} />
        </button>
        <span className="text-[11px] text-nexus-dim font-mono flex-1 truncate">workspace/{path === '.' ? '' : path}</span>
        <button onClick={() => load(path)} className="text-nexus-line hover:text-white">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r border-nexus-line/20 overflow-y-auto scrollbar-thin">
          {error && <div className="p-3 text-[11px] text-nexus-accent font-mono">{error}</div>}
          {!error && entries.length === 0 && (
            <div className="p-3 text-[11px] text-nexus-line font-mono">
              Empty. Ask the agent to write a file here.
            </div>
          )}
          {entries.map((e) => (
            <button
              key={e.name}
              onClick={() => openEntry(e)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-white/5 ${
                selected && selected.endsWith(e.name) ? 'bg-white/5 text-white' : 'text-nexus-dim'
              }`}
            >
              {e.dir ? (
                <Folder size={13} className="text-nexus-blue shrink-0" />
              ) : (
                <FileText size={13} className="text-nexus-line shrink-0" />
              )}
              <span className="truncate">{e.name}</span>
            </button>
          ))}
        </div>

        <div className="w-1/2 overflow-auto scrollbar-thin">
          {selected ? (
            <pre className="p-3 text-[11px] text-nexus-dim font-mono whitespace-pre-wrap break-words">
              {content}
            </pre>
          ) : (
            <div className="p-3 text-[11px] text-nexus-line font-mono">Select a file to preview.</div>
          )}
        </div>
      </div>
    </div>
  )
}
