// ─── MockAIService ────────────────────────────────────────────────
// Used when no AI proxy is configured or during development.
// Returns realistic-looking responses with a simulated delay.
// Never makes network calls. Lang-aware — same reasoning as
// RealAIService's systemPrompt(): nothing here should default to
// English when the app's UI language is Spanish.

import i18n from '../../i18n/index.js'

function delay(ms = 800) { return new Promise(r => setTimeout(r, ms)) }

function pickN(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

function isEs(lang) { return lang?.slice(0, 2) === 'es' }

function causeLabel(cause, lang) {
  return i18n.getFixedT(isEs(lang) ? 'es' : 'en')(`deathCause.${cause}`)
}

const TAG_BANK = {
  en: {
    SKETCH:      ['layout', 'wireframe', 'ui', 'hero', 'concept', 'prototype'],
    COPYWRITING: ['brand-voice', 'tone', 'copy', 'headline', 'manifesto', 'tagline'],
    PALETTE:     ['color', 'accessibility', 'contrast', 'dark-mode', 'brand', 'typography'],
    BRANDING:    ['logo', 'identity', 'mark', 'icon', 'wordmark', 'visual'],
    NOTES:       ['brainstorm', 'ideas', 'research', 'ux', 'mobile', 'feedback'],
  },
  es: {
    SKETCH:      ['layout', 'wireframe', 'ui', 'hero', 'concepto', 'prototipo'],
    COPYWRITING: ['voz-de-marca', 'tono', 'copy', 'titular', 'manifiesto', 'eslogan'],
    PALETTE:     ['color', 'accesibilidad', 'contraste', 'modo-oscuro', 'marca', 'tipografía'],
    BRANDING:    ['logo', 'identidad', 'marca', 'ícono', 'wordmark', 'visual'],
    NOTES:       ['lluvia-de-ideas', 'ideas', 'investigación', 'ux', 'mobile', 'feedback'],
  },
}

const STOPWORDS = new Set([
  // English
  'this', 'that', 'with', 'from', 'were', 'have', 'been',
  // Spanish
  'este', 'esta', 'esto', 'para', 'desde', 'fueron', 'tiene', 'sido', 'como', 'pero',
])

const MockAIService = {
  async suggestTags(title, description, category = 'NOTES', lang) {
    await delay(900)
    const bank  = (isEs(lang) ? TAG_BANK.es : TAG_BANK.en)[category] ?? (isEs(lang) ? TAG_BANK.es : TAG_BANK.en).NOTES
    const words = `${title} ${description}`.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    // Mix some derived-from-content tags with bank tags
    const derived = words.filter(w => !STOPWORDS.has(w)).slice(0, 2)
    return { tags: [...new Set([...pickN(bank, 3), ...derived])].slice(0, 5) }
  },

  async enhanceDescription(title, description, lang) {
    await delay(1100)
    const enhanced = isEs(lang)
      ? (description && description.length > 20
          ? `${description} Se dejó de lado originalmente por el alcance y los tiempos, pero conserva buen potencial como referencia para desafíos parecidos.`
          : `Esta ${title.toLowerCase()} se exploró durante un sprint de diseño intensivo. No llegó a la versión final, pero el razonamiento y la dirección visual siguen siendo valiosos para futuras iteraciones.`)
      : (description && description.length > 20
          ? `${description} Originally shelved due to scope and timeline constraints, this concept retains strong potential as a future reference point for similar challenges.`
          : `This ${title.toLowerCase()} was explored during an intensive design sprint. While it didn't make the final cut, the core reasoning and visual direction remain valuable for future iterations.`)
    return { description: enhanced }
  },

  async analyzeRelic(relic, lang) {
    await delay(1200)
    const reasons = isEs(lang) ? [
      'El diseño iba más adelantado que la capacidad técnica del equipo en ese momento.',
      'Las prioridades cambiaron antes de poder validarlo del todo.',
      'Problemas de accesibilidad exigían repensar el enfoque desde la base.',
      'El alcance creció más de lo que el sprint podía absorber.',
      'Las pruebas con usuarios mostraron que no coincidía con sus modelos mentales.',
    ] : [
      'The design was ahead of the team\'s current technical capacity.',
      'Stakeholder priorities shifted before this could be fully validated.',
      'Accessibility concerns required a fundamental rethink of the approach.',
      'The scope grew beyond what the sprint timeline could accommodate.',
      'User testing revealed misalignment with mental models.',
    ]
    const potentials = isEs(lang) ? [
      'Alto — el concepto de base resuelve un problema real; vale la pena retomarlo.',
      'Medio — necesita ajustes pero la dirección es sólida.',
      'Alto — se descartó por motivos de proceso, no de concepto.',
      'Medio — combinalo con restricciones nuevas para una iteración más fuerte.',
    ] : [
      'High — the core concept solves a real problem; worth revisiting in Q3.',
      'Medium — needs refinement but the direction is sound.',
      'High — this was discarded for procedural, not conceptual, reasons.',
      'Medium — pair it with newer constraints for a stronger iteration.',
    ]
    const suggestions = isEs(lang) ? [
      'Combinala con los lineamientos de marca actuales y revisala de nuevo.',
      `Explorá una versión simplificada de "${relic.title}" pensada para mobile.`,
      'Compartila con el resto del equipo — alguien más puede ver el camino.',
      'Marcala como referencia para el próximo sprint de diseño.',
    ] : [
      'Pair with current brand guidelines and re-evaluate.',
      `Explore a simplified version of "${relic.title}" for mobile-first contexts.`,
      'Share with the wider team — someone else may see the path forward.',
      'Tag as a reference for the next design sprint.',
    ]
    return {
      summary:     relic.deathCauseDetail
        || (relic.deathCause && `${causeLabel(relic.deathCause, lang)}.`)
        || reasons[Math.floor(Math.random() * reasons.length)],
      potential:   potentials[Math.floor(Math.random() * potentials.length)],
      suggestions: pickN(suggestions, 2),
    }
  },

  async archiveInsights(relics, lang) {
    await delay(1400)
    const cats   = relics.reduce((acc, r) => { acc[r.category] = (acc[r.category]||0)+1; return acc }, {})
    const topCat = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'SKETCH'
    const revivable = relics.filter(r => !r.revived).slice(0, 3).map(r => r.id)
    const revivedCount = relics.filter(r=>r.revived).length
    const causes = relics.reduce((acc, r) => { if (r.deathCause) acc[r.deathCause] = (acc[r.deathCause]||0)+1; return acc }, {})
    const topCause = Object.entries(causes).sort((a,b)=>b[1]-a[1])[0]
    const causePattern = topCause && (isEs(lang)
      ? [`La causa de muerte más frecuente es «${causeLabel(topCause[0], lang)}» (${topCause[1]}).`]
      : [`The most common cause of death is "${causeLabel(topCause[0], lang)}" (${topCause[1]}).`])
    if (isEs(lang)) {
      return {
        overview: `Tu archivo tiene ${relics.length} reliquias en ${Object.keys(cats).length} categorías. La mayoría de las ideas descartadas caen en ${topCat}, lo que sugiere que ahí es donde tu equipo experimenta con más audacia.`,
        patterns: [
          ...(causePattern ?? []),
          `${topCat} es tu categoría más activa — considerá dedicarle sesiones de revival propias.`,
          'Las ideas descartadas por motivos técnicos suelen envejecer bien — la tecnología cambia, los conceptos no.',
          `${revivedCount} reliquias ya fueron revividas, lo que muestra un retorno real sobre tu archivo.`,
        ],
        topRevivalCandidates: revivable,
        tip: 'Revisá las reliquias de más de 90 días — la distancia suele revelar valor que la urgencia esconde.',
      }
    }
    return {
      overview: `Your archive holds ${relics.length} relics across ${Object.keys(cats).length} categories. Most discarded ideas fall under ${topCat}, suggesting this is where your team experiments most boldly.`,
      patterns: [
        ...(causePattern ?? []),
        `${topCat} is your most active creative category — consider allocating dedicated revival sessions for it.`,
        'Ideas discarded for technical reasons tend to age well — technology changes, concepts don\'t.',
        `${revivedCount} relics have already been revived, showing your archive has real return on investment.`,
      ],
      topRevivalCandidates: revivable,
      tip: 'Review relics older than 90 days — distance often reveals value that urgency hides.',
    }
  },
}

export default MockAIService
