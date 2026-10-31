// ─── relicDataEvents ──────────────────────────────────────────────
// Attachments and drafts live outside the relic list, and several mounted
// components show them independently (RelicCard's badges, RelicDetails, an
// open EditRelicModal). This tells them all when a relic's data changed.

const EVENT = 'am:relic-data-changed'

export function emitRelicDataChanged(relicId) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { relicId } }))
}

/** @returns {() => void} unsubscribe */
export function onRelicDataChanged(relicId, callback) {
  function handler(event) {
    if (event.detail.relicId === relicId) callback()
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
