// ─── useFocusTrap ─────────────────────────────────────────────────
// Keeps Tab inside an open dialog and hands focus back to whatever opened
// it on close. Only the topmost dialog traps: a confirm opened over a modal
// must not have focus pulled back into the modal behind it.

import { useEffect } from 'react'

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'

export function useFocusTrap(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const previous = document.activeElement

    function visibleItems() {
      return [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
    }

    function onKeyDown(e) {
      if (e.key !== 'Tab') return
      const dialogs = document.querySelectorAll('[aria-modal="true"]')
      if (dialogs[dialogs.length - 1] !== root) return
      const items = visibleItems()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!root.contains(active) || (e.shiftKey && active === first)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    if (!root.contains(document.activeElement)) visibleItems()[0]?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [ref])
}
