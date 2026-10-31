// ─── useViewport ──────────────────────────────────────────────────
// Live media queries for the layout decisions that can't be plain CSS,
// since most of this app's styling is inline.

import { useSyncExternalStore } from 'react'

function useMediaQuery(query) {
  return useSyncExternalStore(
    callback => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
  )
}

/** One-column layout: phones, and any window too narrow for the three panels. */
export function useIsMobile() {
  return useMediaQuery('(max-width: 820px)')
}

/** Primarily touch. Dragging a card here would fight with scrolling the list. */
export function useIsTouch() {
  return useMediaQuery('(pointer: coarse)')
}
