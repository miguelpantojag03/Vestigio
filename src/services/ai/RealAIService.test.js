import { describe, it, expect, afterEach, vi } from 'vitest'
import makeRealAIService, { parseModelJson } from './RealAIService.js'

function mockModelReply(text) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ content: [{ text }] }),
  })))
}

afterEach(() => vi.unstubAllGlobals())

describe('parseModelJson', () => {
  it('parses bare JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips markdown fences', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('finds the JSON inside surrounding prose', () => {
    expect(parseModelJson('Here is the result:\n{"a":{"b":2}}\nHope that helps!')).toEqual({ a: { b: 2 } })
  })

  it('throws when there is no JSON at all', () => {
    expect(() => parseModelJson('Sorry, I cannot help with that.')).toThrow()
  })
})

describe('makeRealAIService shape guarantees', () => {
  const service = makeRealAIService()

  it('turns a malformed insights reply into something the UI can render', async () => {
    mockModelReply(JSON.stringify({
      overview: { text: 'not a string' },
      patterns: 'a string, not a list',
      topRevivalCandidates: ['relic_1', { id: 'relic_2' }],
    }))

    await expect(service.archiveInsights([], 'es')).resolves.toEqual({
      overview: '', patterns: [], topRevivalCandidates: ['relic_1'], tip: '',
    })
  })

  it('never returns undefined analysis fields', async () => {
    mockModelReply('{"summary":"Why it was dropped."}')

    await expect(service.analyzeRelic({ title: 't' }, 'es')).resolves.toEqual({
      summary: 'Why it was dropped.', potential: '', suggestions: [],
    })
  })

  it('normalizes tags and survives a reply with none', async () => {
    mockModelReply('{"tags":["  Brand ","", 7]}')
    await expect(service.suggestTags('t', 'd', 'NOTES', 'es')).resolves.toEqual({ tags: ['brand'] })

    mockModelReply('{"tags":"oops"}')
    await expect(service.suggestTags('t', 'd', 'NOTES', 'es')).resolves.toEqual({ tags: [] })
  })
})
