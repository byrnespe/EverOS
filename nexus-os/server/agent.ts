import Anthropic from '@anthropic-ai/sdk'
import type { AgentEvent } from '../src/os/protocol.js'
import { runTool, toolSchemas, type UiAction } from './tools.js'

const MODEL = process.env.NEXUS_MODEL || 'claude-opus-4-8'
const MAX_TOKENS = 8192
const MAX_TOOL_TURNS = 12

const SYSTEM_PROMPT = `You are NEXUS, the resident agent of an "agentic OS" — a windowed desktop the user is looking at right now.

You are not a chatbot describing what an OS could do; you operate this one. You have real tools:
- list_dir / read_file / write_file work on a real sandboxed workspace folder.
- get_system_info returns real host metrics.
- fetch_url retrieves real web pages.
- open_app / close_app actually open and close windows on the desktop the user sees (apps: terminal, files, monitor, activity).

Operating style:
- When an action would help, take it. After you write a file, open the "files" window so the user sees it. When the user asks about system health, open "monitor". Don't ask permission for these reversible, in-OS actions — just do them and mention it briefly.
- Lead with the outcome. Keep replies short and concrete; the user is watching the desktop, not reading an essay. One or two sentences is usually right.
- For minor choices, pick a sensible option and note it rather than asking.
- Be honest: if a tool fails, say so plainly.`

type Emit = (event: AgentEvent) => void

interface StoredMessage {
  role: 'user' | 'assistant'
  content: Anthropic.ContentBlockParam[] | string
}

// In-memory per-session conversation history. The Messages API is stateless, so
// we keep the full transcript (including thinking + tool blocks) server-side and
// only ship the user's new line over the wire each turn.
const sessions = new Map<string, StoredMessage[]>()

let client: Anthropic | null = null
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic()
  return client
}

export function isLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export function modelName(): string {
  return MODEL
}

export function resetSession(sessionId: string): void {
  sessions.delete(sessionId)
}

/** Drive one user turn to completion, streaming events as they happen. */
export async function runTurn(
  sessionId: string,
  userMessage: string,
  emit: Emit,
  applyUi: (action: UiAction) => void,
): Promise<void> {
  const anthropic = getClient()
  emit({ type: 'meta', mode: anthropic ? 'live' : 'simulated', model: MODEL })

  if (!anthropic) {
    await runSimulatedTurn(userMessage, emit, applyUi)
    return
  }

  const history = sessions.get(sessionId) ?? []
  history.push({ role: 'user', content: userMessage })

  const ctx = {
    emitUi: (action: UiAction) => {
      applyUi(action)
      emit({ type: 'ui_action', action })
    },
  }

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      emit({ type: 'status', state: 'thinking' })

      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive', display: 'summarized' },
        tools: toolSchemas(),
        messages: history as Anthropic.MessageParam[],
      })

      let sawText = false
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'thinking_delta') {
            emit({ type: 'thinking', text: event.delta.thinking })
          } else if (event.delta.type === 'text_delta') {
            if (!sawText) {
              sawText = true
              emit({ type: 'status', state: 'responding' })
            }
            emit({ type: 'token', text: event.delta.text })
          }
        }
      }

      const final = await stream.finalMessage()
      history.push({ role: 'assistant', content: final.content })

      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      if (final.stop_reason !== 'tool_use' || toolUses.length === 0) break

      // Execute every requested tool, then return all results in one user turn.
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const use of toolUses) {
        emit({ type: 'status', state: 'tool', label: use.name })
        emit({ type: 'tool_use', id: use.id, name: use.name, input: use.input })
        const result = await runTool(use.name, use.input as Record<string, unknown>, ctx)
        emit({
          type: 'tool_result',
          id: use.id,
          name: use.name,
          content: result.content,
          isError: Boolean(result.isError),
        })
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: result.content,
          is_error: result.isError,
        })
      }
      history.push({ role: 'user', content: results })
    }

    sessions.set(sessionId, history)
    emit({ type: 'status', state: 'idle' })
    emit({ type: 'done' })
  } catch (e) {
    emit({ type: 'error', message: (e as Error).message })
    emit({ type: 'status', state: 'idle' })
    emit({ type: 'done' })
  }
}

/**
 * No-API-key mode. The pipeline is identical and a real tool still runs — only
 * the language model is replaced by a scripted response, clearly labeled in the
 * UI as simulated.
 */
async function runSimulatedTurn(
  userMessage: string,
  emit: Emit,
  applyUi: (action: UiAction) => void,
): Promise<void> {
  const ctx = {
    emitUi: (action: UiAction) => {
      applyUi(action)
      emit({ type: 'ui_action', action })
    },
  }

  emit({ type: 'status', state: 'thinking' })
  await stream(emit, 'No ANTHROPIC_API_KEY is set, so I am running in simulated mode. ')
  await stream(emit, 'The agent loop, tools, and streaming are still real — here is live host data: ')

  // Genuinely invoke a tool so the wiring is demonstrable.
  const id = 'sim_' + Date.now().toString(36)
  emit({ type: 'status', state: 'tool', label: 'get_system_info' })
  emit({ type: 'tool_use', id, name: 'get_system_info', input: {} })
  const result = await runTool('get_system_info', {}, ctx)
  emit({ type: 'tool_result', id, name: 'get_system_info', content: result.content, isError: false })

  if (/monitor|cpu|memory|health|system/i.test(userMessage)) {
    ctx.emitUi({ type: 'open_app', appId: 'monitor' })
  }

  emit({ type: 'status', state: 'responding' })
  await stream(
    emit,
    '\n\nSet your API key in nexus-os/.env and restart to run the real Claude agent.',
  )
  emit({ type: 'status', state: 'idle' })
  emit({ type: 'done' })
}

async function stream(emit: Emit, text: string): Promise<void> {
  for (const word of text.split(/(\s+)/)) {
    emit({ type: 'token', text: word })
    await new Promise((r) => setTimeout(r, 18))
  }
}
