import { createApp } from './app.js'
import { isLive, modelName } from './agent.js'

// Local dev / standalone server. On Vercel the app is served via api/index.ts.
const PORT = Number(process.env.NEXUS_PORT || 8787)

createApp().listen(PORT, () => {
  const mode = isLive() ? `live (${modelName()})` : 'simulated (no ANTHROPIC_API_KEY)'
  // eslint-disable-next-line no-console
  console.log(`[nexus] agent backend on http://localhost:${PORT} — mode: ${mode}`)
})
