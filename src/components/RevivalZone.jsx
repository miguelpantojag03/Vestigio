import { forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Sparkles, RotateCcw } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

const RevivalZone = forwardRef(function RevivalZone({ isDragging, isDragOver, justRevived }, ref) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  return (
    <motion.div
      ref={ref}
      className="glass"
      animate={{
        // Rises to meet a card as soon as one is picked up: says where it can go.
        scale: isDragOver ? 1.015 : isDragging ? 1.005 : 1,
        borderColor: isDragOver ? alpha(color.blue300, 0.7) : isDragging ? alpha(color.blue300, 0.5) : alpha(color.blue500, 0.4),
      }}
      transition={spring.tap}
      style={{
        position: 'absolute', bottom: 14, left: 16, right: 16,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 18px', borderRadius: radius.glass,
        borderStyle: 'dashed', borderWidth: 1.5,
        background: isDragOver ? alpha(color.blue500, 0.22) : isDragging ? alpha(color.blue500, 0.14) : alpha(color.blue500, 0.08),
        boxShadow: isDragOver ? `0 0 32px ${alpha(color.blue500, 0.28)}` : 'none',
        zIndex: 10,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: alpha(color.blue500, 0.22), border: `1px solid ${alpha(color.blue500, 0.4)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={16} style={{ color: color.blue300 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: color.blue300, marginBottom: 2, fontFamily: font.mono }}>
          {t('revivalZone.tag')}
        </div>
        <div style={{ fontSize: 11, color: color.textSecondary, fontFamily: font.ui }}>
          {t('revivalZone.label')}
        </div>
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: color.blue500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.onPrimary,
      }}>
        <RotateCcw size={14} />
      </div>

      {/* success pulse on a successful drop */}
      <AnimatePresence>
        {justRevived && (
          <motion.div
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.08 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: -2, borderRadius: radius.glass,
              boxShadow: `0 0 0 3px ${color.sage500}, 0 0 40px ${alpha(color.sage500, 0.5)}`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default RevivalZone
