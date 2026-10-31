// ─── similarity ───────────────────────────────────────────────────
// Lightweight, fully offline lexical similarity — Dice's coefficient
// over character bigrams. No network call, no model, no deps.
//
// Honest limitation: this catches near-duplicate rephrasing and typos
// ("gato robot" vs "robot gato"), NOT conceptually similar ideas that
// use different words ("mascota robótica" vs "androide felino"). That
// needs real semantic comparison (embeddings or an LLM call), which is
// a separate, opt-in tier — see the roadmap notes.

// Relics saved with no description used to get this literal placeholder,
// and older ones still have it stored — without excluding it,
// any two undescribed relics would score as a perfect description
// match purely by coincidence.
const EMPTY_DESCRIPTION_PLACEHOLDER = 'no description.'

function normalize(str) {
  return (str ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigramCounts(str) {
  const s = normalize(str)
  const counts = new Map()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    counts.set(bg, (counts.get(bg) ?? 0) + 1)
  }
  return counts
}

/** Dice coefficient (0..1) between two strings' character bigrams. */
export function diceCoefficient(a, b) {
  const A = bigramCounts(a)
  const B = bigramCounts(b)
  if (A.size === 0 || B.size === 0) return 0
  let overlap = 0
  let totalA = 0
  let totalB = 0
  for (const n of A.values()) totalA += n
  for (const n of B.values()) totalB += n
  for (const [bg, countA] of A) {
    const countB = B.get(bg)
    if (countB) overlap += Math.min(countA, countB)
  }
  return (2 * overlap) / (totalA + totalB)
}

function hasRealDescription(desc) {
  const d = desc?.trim()
  return !!d && d.toLowerCase() !== EMPTY_DESCRIPTION_PLACEHOLDER
}

const DEFAULT_THRESHOLD = 0.5

/**
 * Finds existing relics that look like near-duplicates of the given
 * title/description. Offline, lexical only — see module doc for what
 * it can't catch.
 * @returns {{relic: object, score: number}[]} sorted by score desc
 */
export function findSimilarRelics(title, description, relics, { excludeId, limit = 3, threshold = DEFAULT_THRESHOLD } = {}) {
  if (!title?.trim() || !relics?.length) return []
  const newHasDesc = hasRealDescription(description)

  const results = []
  for (const relic of relics) {
    if (relic.id === excludeId) continue
    const titleScore = diceCoefficient(title, relic.title)
    const bothHaveDesc = newHasDesc && hasRealDescription(relic.description)
    const score = bothHaveDesc
      ? titleScore * 0.65 + diceCoefficient(description, relic.description) * 0.35
      : titleScore
    if (score >= threshold) results.push({ relic, score })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
