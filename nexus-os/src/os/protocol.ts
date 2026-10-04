// Wire protocol shared by the agent backend and the desktop frontend.
// Server streams these as Server-Sent Events; the client renders them.

export type AgentState = 'idle' | 'thinking' | 'tool' | 'responding'

export type UiActionType = 'open_app' | 'close_app'

export interface UiAction {
  type: UiActionType
  appId: string
}

export type AgentEvent =
  | { type: 'meta'; mode: 'live' | 'simulated'; model: string }
  | { type: 'status'; state: AgentState; label?: string }
  | { type: 'thinking'; text: string }
  | { type: 'token'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; content: string; isError: boolean }
  | { type: 'ui_action'; action: UiAction }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface AgentRequest {
  sessionId: string
  message: string
}
