// ─── platform ─────────────────────────────────────────────────────
// What the app is running on, for the few things that genuinely differ.
// Layout decisions use useViewport (a narrow desktop window counts as
// "mobile" too); this is only for what Android itself can't do.

export const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
