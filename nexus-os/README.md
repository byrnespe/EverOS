# NEXUS OS — an agentic OS that *is* agentic

A windowed desktop driven by a **real Claude agent loop**. Same dark, orange-accented
aesthetic as the inspiration build (nebula background, reactive agent orb, draggable
terminal windows) — but the agent is genuinely an agent: it streams, it thinks, and
its tools actually execute on the host.

The difference from a UI mockup, in one line: **ask it to "write a haiku to a file and
open the file viewer," and it does — the file lands on disk and the window opens.**

## What's real here

| Capability | How it's real |
|---|---|
| Agent loop | A manual tool-use loop over the Anthropic Messages API (`claude-opus-4-8`), streamed token-by-token via SSE. |
| Thinking | Adaptive thinking, summarized, streamed to the orb and an expandable panel. |
| Tools | Every tool executes on the Node backend — no canned replies. |
| `list_dir` / `read_file` / `write_file` | Real filesystem ops, sandboxed to `./workspace`. |
| `get_system_info` / System Monitor | Real host metrics from Node's `os` module. |
| `fetch_url` | Real HTTP fetch. |
| `open_app` / `close_app` | The agent literally opens and closes desktop windows. |
| Tool Activity window | A live ledger of every real tool call. |

The agent orb's churn, spin, and colour are driven by the **actual** agent state
(`idle` / `thinking` / `tool` / `responding`) coming off the event stream — not a timer.

## Run it

```bash
cd nexus-os
npm install
cp .env.example .env      # then paste your ANTHROPIC_API_KEY into .env
npm run dev               # starts the agent backend + the web desktop
```

Open the printed Vite URL (default http://localhost:5173).

**No API key?** It still runs — in a clearly-labeled *simulated* mode (the top bar shows
`simulated`). The agent loop, tools, streaming, and a real `get_system_info` call all
still fire; only the language model is replaced by a scripted stub. Add a key and restart
to go live.

## Architecture

```
browser (Vite/React)  ──POST /api/agent──►  Node/Express backend
   │  SSE event stream  ◄───────────────────  Anthropic Messages API (agent loop)
   │                                              │ tool_use
   └─ desktop applies ui_action events            ▼
      (open/close windows)                     tools.ts  ── real fs / os / fetch
```

- `server/agent.ts` — the streaming agent loop + per-session transcript (incl. thinking & tool blocks).
- `server/tools.ts` — the executable tool surface (sandboxed).
- `server/index.ts` — SSE endpoint plus read-only `/api/system` and `/api/fs` for the live windows.
- `src/os/OsContext.tsx` — window manager + agent event router.
- `src/components/AgentOrb.tsx`, `NebulaField.tsx` — the WebGL aesthetic (corrected shaders).

## Try

- "What's this machine running? Show me the monitor."
- "Write a file `notes/todo.md` with three tasks, then open the files window."
- "Fetch example.com and summarize it."
- "Close the monitor and just talk to me."

## Notes

The model defaults to `claude-opus-4-8`; override with `NEXUS_MODEL`. The backend keeps
conversation state in memory per session, so a server restart clears history. The
`workspace/` folder is the agent's sandbox and is gitignored.
