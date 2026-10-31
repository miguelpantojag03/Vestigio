import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, MonitorSmartphone, Languages } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { setLanguage } from '../i18n/index.js'

const THEME_ICONS = { light: Sun, dark: Moon, auto: MonitorSmartphone }
const THEME_ORDER = ['light', 'dark', 'auto']
const LANG_ORDER   = ['es', 'en']

// Small glass dropdown shared shape for both the theme and language pickers.
function IconDropdown({ icon: Icon, label, current, options, renderLabel, onPick, align = 'right' }) {
  const { color, radius, font, spring } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOpen(o => !o)}
        title={label} aria-label={label} aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: radius.control,
          border: `1px solid ${open ? color.blue500 : color.bgBorder}`,
          background: alpha(color.bgBase, 0.35), color: color.textPrimary, cursor: 'pointer',
        }}>
        <Icon size={14} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={spring.tap}
            className="glass glass-neutral"
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', [align]: 0,
              borderRadius: radius.card, padding: '4px 0', minWidth: 140, zIndex: 50,
              transformOrigin: `top ${align}`,
            }}>
            {options.map(opt => {
              const active = opt === current
              return (
                <button key={opt}
                  onClick={() => { onPick(opt); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    color: active ? color.blue500 : color.textPrimary, fontSize: 12, fontFamily: font.ui,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = color.hoverOverlay}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {renderLabel(opt)}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ThemeControl() {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()
  const Icon = THEME_ICONS[mode]
  return (
    <IconDropdown icon={Icon} label={t('topbar.theme')} current={mode} options={THEME_ORDER} onPick={setMode}
      renderLabel={opt => t(`theme.${opt}`)} />
  )
}

export function LanguageControl() {
  const { t, i18n } = useTranslation()
  const current = i18n.language?.startsWith('en') ? 'en' : 'es'
  return (
    <IconDropdown icon={Languages} label={t('topbar.language')} current={current} options={LANG_ORDER} onPick={setLanguage}
      renderLabel={opt => opt.toUpperCase()} />
  )
}
