// ─── vestigio-ai-proxy ────────────────────────────────────────────
// Thin gate in front of Cloudflare Workers AI (env.AI binding — see
// wrangler.toml). No external API key to protect: Workers AI runs
// in-account on Cloudflare's free tier. The only thing this Worker
// guards against is casual/scripted abuse of the public endpoint,
// via a shared secret the app also knows (APP_SHARED_SECRET). It
// stores nothing, logs nothing beyond Cloudflare's own request logs,
// and knows nothing about users.
//
// The shared secret ships inside the app, so anyone determined can extract it.
// What actually bounds the damage is below: requests per minute per IP, and
// how much each request may ask for.
//
// Request/response shape is kept the same as the Anthropic Messages
// API this Worker used to proxy ({ system, messages, max_tokens } in,
// { content: [{ text }] } out) so the frontend (RealAIService.js)
// doesn't need to know which model is actually answering — only this
// file needs to change if the model is swapped again later.

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'
const MAX_TOKENS = 1024
const MAX_BODY_CHARS = 20000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-app-secret',
}

function errorResponse(status, message) {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
  )
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
    }
    if (request.headers.get('x-app-secret') !== env.APP_SHARED_SECRET) {
      return new Response('Forbidden', { status: 403, headers: CORS_HEADERS })
    }

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const { success } = await env.RATE_LIMITER.limit({ key: ip })
    if (!success) return errorResponse(429, 'Rate limit exceeded')

    const body = await request.text()
    if (body.length > MAX_BODY_CHARS) return errorResponse(413, 'Request too large')

    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return errorResponse(400, 'Invalid JSON body')
    }
    if (!payload || typeof payload !== 'object') return errorResponse(400, 'Invalid JSON body')

    const { system, messages, max_tokens } = payload
    const userMessage = messages?.[0]?.content ?? ''

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: system ?? '' },
          { role: 'user', content: userMessage },
        ],
        max_tokens: Math.min(Number(max_tokens) || 512, MAX_TOKENS),
      })

      return new Response(
        JSON.stringify({ content: [{ text: result?.response ?? '' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      )
    } catch (err) {
      return errorResponse(502, String(err?.message ?? err))
    }
  },
}
