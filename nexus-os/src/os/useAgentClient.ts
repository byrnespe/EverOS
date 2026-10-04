import type { AgentEvent, AgentRequest } from './protocol'

/**
 * POST a turn and consume the Server-Sent Event stream, invoking `onEvent` for
 * each agent event as it arrives. Resolves when the stream closes.
 */
export async function streamAgent(
  req: AgentRequest,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `agent request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        onEvent(JSON.parse(payload) as AgentEvent)
      } catch {
        // ignore malformed frame
      }
    }
  }
}
