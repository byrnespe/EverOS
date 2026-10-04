// Vercel serverless entry. The whole Express app is exported as the request
// handler; vercel.json rewrites every /api/* path to this function.
import { createApp } from '../server/app.js'

export default createApp()
