import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * The agent's real tool surface. Every tool here actually executes on the host
 * — there are no canned responses. File tools are sandboxed to ./workspace.
 *
 * Two of the tools (`open_app` / `close_app`) don't return data; they emit a UI
 * action that the desktop applies, which is what lets the agent literally drive
 * the windowed OS. The server passes an `emitUi` callback for those.
 */

export const WORKSPACE = path.resolve(process.cwd(), 'workspace')

export interface UiAction {
  type: 'open_app' | 'close_app'
  appId: string
}

export type ToolInput = Record<string, unknown>

export interface ToolContext {
  emitUi: (action: UiAction) => void
}

export interface ToolResult {
  content: string
  isError?: boolean
}

interface ToolDef {
  name: string
  description: string
  input_schema: Anthropic.Tool.InputSchema
  run: (input: ToolInput, ctx: ToolContext) => Promise<ToolResult>
}

const KNOWN_APPS = ['terminal', 'files', 'monitor', 'activity'] as const

async function ensureWorkspace(): Promise<void> {
  await fs.mkdir(WORKSPACE, { recursive: true })
}

/** Resolve a user/agent-supplied path and refuse anything escaping the sandbox. */
function safePath(rel: string): string {
  const resolved = path.resolve(WORKSPACE, rel ?? '.')
  if (resolved !== WORKSPACE && !resolved.startsWith(WORKSPACE + path.sep)) {
    throw new Error(`path '${rel}' escapes the workspace sandbox`)
  }
  return resolved
}

function ok(content: string): ToolResult {
  return { content }
}

function fail(message: string): ToolResult {
  return { content: `Error: ${message}`, isError: true }
}

const TOOLS: ToolDef[] = [
  {
    name: 'list_dir',
    description:
      'List files and folders inside the workspace. Use this before reading or writing to see what exists.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: "Relative path inside the workspace. Defaults to '.'." },
      },
    },
    run: async (input) => {
      await ensureWorkspace()
      try {
        const dir = safePath(String(input.path ?? '.'))
        const entries = await fs.readdir(dir, { withFileTypes: true })
        if (entries.length === 0) return ok('(empty)')
        const lines = entries
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((e) => `${e.isDirectory() ? 'dir ' : 'file'}  ${e.name}`)
        return ok(lines.join('\n'))
      } catch (e) {
        return fail((e as Error).message)
      }
    },
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file from the workspace.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path inside the workspace.' } },
      required: ['path'],
    },
    run: async (input) => {
      await ensureWorkspace()
      try {
        const file = safePath(String(input.path))
        const data = await fs.readFile(file, 'utf8')
        return ok(data.length > 20000 ? data.slice(0, 20000) + '\n…(truncated)' : data)
      } catch (e) {
        return fail((e as Error).message)
      }
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a UTF-8 text file in the workspace. Parent folders are created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the workspace.' },
        content: { type: 'string', description: 'Full file contents to write.' },
      },
      required: ['path', 'content'],
    },
    run: async (input) => {
      await ensureWorkspace()
      try {
        const file = safePath(String(input.path))
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, String(input.content ?? ''), 'utf8')
        return ok(`Wrote ${Buffer.byteLength(String(input.content ?? ''))} bytes to ${input.path}`)
      } catch (e) {
        return fail((e as Error).message)
      }
    },
  },
  {
    name: 'get_system_info',
    description:
      'Return real host metrics for this machine: CPU model and load, memory usage, platform, and uptime.',
    input_schema: { type: 'object', properties: {} },
    run: async () => {
      const total = os.totalmem()
      const free = os.freemem()
      const cpus = os.cpus()
      const load = os.loadavg()
      const info = {
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        cpu: cpus[0]?.model?.trim() ?? 'unknown',
        cores: cpus.length,
        load_avg_1m: Number(load[0].toFixed(2)),
        memory_used_gb: Number(((total - free) / 1e9).toFixed(2)),
        memory_total_gb: Number((total / 1e9).toFixed(2)),
        uptime_hours: Number((os.uptime() / 3600).toFixed(1)),
      }
      return ok(JSON.stringify(info, null, 2))
    },
  },
  {
    name: 'fetch_url',
    description:
      'Fetch a public URL over HTTP(S) and return its text content (truncated). Useful for reading docs or pages the user references.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Absolute http(s) URL.' } },
      required: ['url'],
    },
    run: async (input) => {
      const url = String(input.url ?? '')
      if (!/^https?:\/\//i.test(url)) return fail('url must start with http:// or https://')
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 15000)
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
        clearTimeout(t)
        const text = await res.text()
        const stripped = text
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const body = stripped.length > 6000 ? stripped.slice(0, 6000) + ' …(truncated)' : stripped
        return ok(`HTTP ${res.status} ${res.statusText}\n\n${body}`)
      } catch (e) {
        return fail((e as Error).message)
      }
    },
  },
  {
    name: 'open_app',
    description:
      `Open a window/app on the desktop so the user can see it. Available apps: ${KNOWN_APPS.join(', ')}. ` +
      'Use this to surface relevant tools — e.g. open "monitor" when discussing system health, or "files" after writing a file.',
    input_schema: {
      type: 'object',
      properties: { app: { type: 'string', enum: KNOWN_APPS as unknown as string[] } },
      required: ['app'],
    },
    run: async (input, ctx) => {
      const app = String(input.app)
      if (!KNOWN_APPS.includes(app as (typeof KNOWN_APPS)[number])) {
        return fail(`unknown app '${app}'. Known: ${KNOWN_APPS.join(', ')}`)
      }
      ctx.emitUi({ type: 'open_app', appId: app })
      return ok(`Opened the ${app} window.`)
    },
  },
  {
    name: 'close_app',
    description: `Close a window/app on the desktop. Available apps: ${KNOWN_APPS.join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: { app: { type: 'string', enum: KNOWN_APPS as unknown as string[] } },
      required: ['app'],
    },
    run: async (input, ctx) => {
      const app = String(input.app)
      if (!KNOWN_APPS.includes(app as (typeof KNOWN_APPS)[number])) {
        return fail(`unknown app '${app}'`)
      }
      ctx.emitUi({ type: 'close_app', appId: app })
      return ok(`Closed the ${app} window.`)
    },
  },
]

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]))

/** Tool schemas in the shape the Anthropic Messages API expects. */
export function toolSchemas(): Anthropic.Tool[] {
  return TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }))
}

export async function runTool(
  name: string,
  input: ToolInput,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = TOOL_MAP.get(name)
  if (!tool) return fail(`unknown tool '${name}'`)
  try {
    return await tool.run(input ?? {}, ctx)
  } catch (e) {
    return fail((e as Error).message)
  }
}

export async function listWorkspace(rel = '.'): Promise<{ name: string; dir: boolean }[]> {
  await ensureWorkspace()
  const dir = safePath(rel)
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .map((e) => ({ name: e.name, dir: e.isDirectory() }))
    .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
}

export async function readWorkspaceFile(rel: string): Promise<string> {
  const file = safePath(rel)
  return fs.readFile(file, 'utf8')
}

export function systemSnapshot() {
  const total = os.totalmem()
  const free = os.freemem()
  const load = os.loadavg()
  const cores = os.cpus().length || 1
  // Normalize 1-minute load average to a rough 0-100 "CPU" figure.
  const cpuPct = Math.min(100, (load[0] / cores) * 100)
  const memPct = ((total - free) / total) * 100
  return {
    cpu: Number(cpuPct.toFixed(1)),
    memory: Number(memPct.toFixed(1)),
    load1: Number(load[0].toFixed(2)),
    cores,
    memUsedGb: Number(((total - free) / 1e9).toFixed(2)),
    memTotalGb: Number((total / 1e9).toFixed(2)),
    uptimeH: Number((os.uptime() / 3600).toFixed(1)),
  }
}
