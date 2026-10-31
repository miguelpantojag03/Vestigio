import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, useIsPresent } from 'framer-motion'
import { useTheme } from '../context/ThemeContext.jsx'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

// Render inside an <AnimatePresence> (see Dashboard) to get the exit
// animation: it leaves the way it came, along the same path.
export default function Modal({ title, onClose, children }) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef)
  // While animating out the modal is still mounted, but it's already gone as
  // far as the user is concerned. Closing or saving a second time here would
  // re-run those handlers, and NewRelicModal's close deletes staged attachments.
  const isPresent = useIsPresent()

  // Close on Escape
  useEffect(() => {
    if (!isPresent) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, isPresent])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={spring.tap}
      inert={!isPresent}
      className="scrim"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: color.scrimBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={spring.drop}
        className="glass glass-neutral"
        style={{
          borderRadius: radius.glass,
          padding: '24px 24px 20px', width: '100%', maxWidth: 440,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 500, fontFamily: font.display, color: color.textPrimary }}>{title}</span>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textSecondary, padding: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = color.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = color.textSecondary}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
