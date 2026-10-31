// ─── ConfirmModal ─────────────────────────────────────────────────
// Styled replacement for window.confirm().
// Usage:
//   const { confirm, ConfirmModalUI } = useConfirm()
//   ...
//   <ConfirmModalUI />
//   ...
//   if (await confirm({ title: '...', message: '...', danger: true })) { ... }

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence, useIsPresent } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

// ── Hook ──────────────────────────────────────────────────────────
// One store and one component per useConfirm() call, created once: a component
// defined during render is a new type every time, so the dialog would remount
// (replaying its animation, losing focus) whenever the parent re-rendered.
function createConfirm() {
  let state = null // { title, message, danger, confirmLabel, cancelLabel }
  let resolve = null
  const listeners = new Set()

  function setState(next) {
    state = next
    listeners.forEach(listener => listener())
  }
  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  function settle(answer) {
    setState(null)
    resolve?.(answer)
    resolve = null
  }

  function confirm({ title, message, danger = false, confirmLabel, cancelLabel }) {
    return new Promise(res => {
      resolve = res
      setState({ title, message, danger, confirmLabel, cancelLabel })
    })
  }

  // Portaled: inside a modal, position:fixed is relative to the modal's
  // transformed surface, not the window.
  function ConfirmModalUI() {
    const current = useSyncExternalStore(subscribe, () => state)
    return createPortal(
      <AnimatePresence>
        {current && <ConfirmModal {...current} onConfirm={() => settle(true)} onCancel={() => settle(false)} />}
      </AnimatePresence>,
      document.body
    )
  }

  return { confirm, ConfirmModalUI }
}

export function useConfirm() {
  const [value] = useState(createConfirm)
  return value
}

// ── Presentational component ──────────────────────────────────────
function ConfirmModal({ title, message, danger, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  const Icon = danger ? AlertTriangle : Info
  const isPresent = useIsPresent()
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef)

  // Escape answers this dialog only, in the capture phase, so it can't also
  // close a modal underneath it.
  useEffect(() => {
    if (!isPresent) return
    function onKeyDown(e) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isPresent, onCancel])

  return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={spring.tap}
        inert={!isPresent}
        className="scrim"
        onClick={e => { if (e.target === e.currentTarget) onCancel() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: color.scrimBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <motion.div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={spring.drop}
          className="glass glass-neutral"
          style={{
            width: '100%', maxWidth: 380,
            borderRadius: radius.glass, padding: '28px 24px 24px',
          }}>
          {/* Icon + title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: radius.control, flexShrink: 0,
              background: danger ? alpha(color.terracotta500, 0.12) : alpha(color.blue500, 0.12),
              border: `1px solid ${danger ? alpha(color.terracotta500, 0.3) : alpha(color.blue500, 0.3)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} style={{ color: danger ? color.terracotta500 : color.blue300 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, fontFamily: font.display, color: color.textPrimary, lineHeight: 1.3 }}>
                {title}
              </div>
              {message && (
                <div style={{ fontSize: 13, color: color.textSecondary, marginTop: 5, lineHeight: 1.55, fontFamily: font.ui }}>
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onCancel}
              autoFocus
              style={{
                padding: '8px 18px', borderRadius: radius.control, border: `1px solid ${color.bgBorder}`,
                background: 'transparent', color: color.textPrimary,
                fontSize: 13, fontWeight: 500, fontFamily: font.ui, cursor: 'pointer',
              }}
            >
              {cancelLabel ?? t('common.cancel')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              style={{
                padding: '8px 18px', borderRadius: radius.control, border: 'none',
                background: danger ? color.terracotta500 : color.blue500,
                color: color.onPrimary, fontSize: 13, fontWeight: 700,
                fontFamily: font.ui, cursor: 'pointer',
              }}
            >
              {confirmLabel ?? (danger ? t('common.delete') : t('common.confirm'))}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
  )
}
