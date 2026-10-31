// ─── RealAIService ────────────────────────────────────────────────
// Calls our own proxy (backend/) for real AI output, never a provider
// directly — the proxy runs Cloudflare Workers AI in-account, no API
// key to ship in the client. VITE_AI_PROXY_URL/VITE_APP_SHARED_SECRET
// come from .env.local (gitignored), same pattern as googleOAuth.js's
// client secret. See backend/src/index.js for the other half of this.
//
// Named generically (not after a specific model) because the model
// behind the proxy can change without this file changing — only
// backend/src/index.js needs to know which one is actually running.

const API_URL = import.meta.env.VITE_AI_PROXY_URL
const MAX_TOKENS = 512

// ── Core request helper ───────────────────────────────────────────
async function callAI(systemPrompt, userMessage, signal) {
  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-app-secret': import.meta.env.VITE_APP_SHARED_SECRET,
    },
    body: JSON.stringify({
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API error ${res.status}`)
  }

  const data   = await res.json()
  return parseModelJson(data.content?.[0]?.text ?? '')
}

// The model is asked for bare JSON but doesn't reliably comply: it may wrap
// it in markdown fences or add a sentence around it.
export function parseModelJson(text) {
  const clean = text.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '').trim()
  try {
    return JSON.parse(clean)
  } catch (err) {
    const start = clean.indexOf('{')
    const end   = clean.lastIndexOf('}')
    if (start === -1 || end <= start) throw err
    return JSON.parse(clean.slice(start, end + 1))
  }
}

// Nor does valid JSON guarantee the promised shape, and the UI renders these
// values directly: a string where a list belongs, or an object where text
// belongs, would crash the whole app through the ErrorBoundary.
function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asTextList(value) {
  return Array.isArray(value) ? value.map(asText).filter(Boolean) : []
}

// ── System prompt shared by all features ──────────────────────────
// Lang-aware: without this, the model defaults to English regardless
// of the app's own UI language — the JSON *keys* stay in English (the
// app parses them by name), only the natural-language *values* inside
// should switch.
const LANG_NAME = { es: 'Spanish', en: 'English' }

function systemPrompt(lang) {
  const languageName = LANG_NAME[lang?.slice(0, 2)] ?? LANG_NAME.en
  return `You are an assistant for "Vestigio", a creative archive app where teams store discarded ideas (called relics). Your tone is thoughtful, concise and slightly poetic — never corporate. Respond ONLY with valid JSON, no markdown fences, no extra text. Keep every JSON key in English exactly as given in the prompt, but write all natural-language text inside the JSON string values in ${languageName}.`
}

// ── Public API ────────────────────────────────────────────────────
function makeRealAIService() {
  return {
    async suggestTags(title, description, category = 'NOTES', lang, signal) {
      const result = await callAI(systemPrompt(lang),
        `Suggest 3 to 5 lowercase tags for this archived creative relic.
Title: "${title}"
Description: "${description}"
Category: ${category}
Return JSON: { "tags": ["tag1","tag2","tag3"] }`,
        signal)
      return { tags: asTextList(result?.tags).map(tag => tag.toLowerCase()) }
    },

    async enhanceDescription(title, description, lang, signal) {
      const result = await callAI(systemPrompt(lang),
        `Improve this description for an archived creative relic. Keep it under 200 characters. Be specific about why it was discarded and what value it retains.
Title: "${title}"
Current description: "${description || 'No description yet.'}"
Return JSON: { "description": "improved text here" }`,
        signal)
      return { description: asText(result?.description) }
    },

    async analyzeRelic(relic, lang, signal) {
      const result = await callAI(systemPrompt(lang),
        `Analyze this discarded creative relic and assess its revival potential.
Title: "${relic.title}"
Category: ${relic.category}
Description: "${relic.description}"
Notes: "${relic.notes || 'None'}"
Stated cause of death: ${relic.deathCause ?? 'Not recorded'}${relic.deathCauseDetail ? ` ("${relic.deathCauseDetail}")` : ''}
Status: ${relic.revived ? 'Already revived' : 'Archived'}
Return JSON: {
  "summary": "one sentence on why it was discarded; rely on the stated cause of death when there is one, otherwise say what likely happened",
  "potential": "one sentence on revival potential",
  "suggestions": ["action 1", "action 2"]
}`,
        signal)
      return {
        summary:     asText(result?.summary),
        potential:   asText(result?.potential),
        suggestions: asTextList(result?.suggestions),
      }
    },

    async archiveInsights(relics, lang, signal) {
      // Send lightweight summaries (no blobs, no base64)
      const summaries = relics.slice(0, 30).map(r => ({
        id: r.id, title: r.title, category: r.category,
        description: r.description?.slice(0, 80),
        revived: r.revived, discardedAt: r.discardedAt,
        causeOfDeath: r.deathCause ?? undefined, causeDetail: r.deathCauseDetail?.slice(0, 80),
      }))
      const result = await callAI(systemPrompt(lang),
        `Analyze this team's creative archive and provide insights. Where causeOfDeath is recorded, weigh recurring causes in the patterns.
Archive (${relics.length} relics): ${JSON.stringify(summaries)}
Return JSON: {
  "overview": "2-3 sentence overview of the archive",
  "patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "topRevivalCandidates": ["relic_id_1", "relic_id_2"],
  "tip": "one actionable creative tip based on these patterns"
}`,
        signal)
      return {
        overview:             asText(result?.overview),
        patterns:             asTextList(result?.patterns),
        topRevivalCandidates: asTextList(result?.topRevivalCandidates),
        tip:                  asText(result?.tip),
      }
    },
  }
}

export default makeRealAIService
