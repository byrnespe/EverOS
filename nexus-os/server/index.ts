import express from 'express'
import { runTurn, resetSession, isLive, modelName } from './agent.js'
import { listWorkspace, readWorkspaceFile, systemSnapshot } from './tools.js'
import type { AgentEvent } from '../src/os/protocol.js'

const PORT = Number(process.env.NEXUS_PORT || 8787)
const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: isLive() ? 'live' : 'simulated', model: modelName() })
})

// Real host metrics — the System Monitor polls this.
app.get('/api/system', (_req, res) => {
  res.json(systemSnapshot())
})

// Real workspace listing + file read — the File Explorer uses these, and they
// reflect whatever the agent has written via its file tools.
app.get('/api/fs', async (req, res) => {
  try {
    const entries = await listWorkspace(String(req.query.path || '.'))
    res.json({ entries })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.get('/api/file', async (req, res) => {
  try {
    const content = await readWorkspaceFile(String(req.query.path || ''))
    res.json({ content })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.post('/api/session/reset', (req, res) => {
  const sessionId = String(req.body?.sessionId || '')
  if (sessionId) resetSession(sessionId)
  res.json({ ok: true })
})

// The agent turn: a POST that streams Server-Sent Events back as the agent works.
app.post('/api/agent', async (req, res) => {
  const sessionId = String(req.body?.sessionId || 'default')
  const message = String(req.body?.message || '').trim()
  if (!message) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (event: AgentEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  // Detect a real client disconnect via the *response* socket. (Watching `req`
  // would fire as soon as the POST body is read, aborting the stream instantly.)
  let aborted = false
  res.on('close', () => {
    aborted = true
  })

  try {
    await runTurn(
      sessionId,
      message,
      (event) => {
        if (!aborted) send(event)
      },
      () => {
        // UI actions are mirrored to the client via the event stream above; the
        // server keeps no desktop state of its own.
      },
    )
  } catch (e) {
    if (!aborted) send({ type: 'error', message: (e as Error).message })
  } finally {
    res.end()
  }
})

app.listen(PORT, () => {
  const mode = isLive() ? `live (${modelName()})` : 'simulated (no ANTHROPIC_API_KEY)'
  // eslint-disable-next-line no-console
  console.log(`[nexus] agent backend on http://localhost:${PORT} — mode: ${mode}`)
})
