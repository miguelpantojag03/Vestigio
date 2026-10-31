import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import logo from '../assets/vestigio-logo.svg'

// Abstract night-museum atmosphere: fog, a moonlight glow, and a few
// blurred silhouettes suggesting distant vitrines — never literal icons.
function Atmosphere() {
  const { color, resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '8%', width: '55%', height: '70%',
        background: dark
          ? `radial-gradient(ellipse at center, ${alpha(color.blue500, 0.16)} 0%, transparent 65%)`
          : `radial-gradient(ellipse at center, ${alpha(color.blue500, 0.10)} 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '5%', width: '50%', height: '60%',
        background: dark
          ? `radial-gradient(ellipse at center, ${alpha(color.lavender500, 0.12)} 0%, transparent 65%)`
          : `radial-gradient(ellipse at center, ${alpha(color.lavender500, 0.08)} 0%, transparent 65%)`,
      }} />
      {/* distant silhouettes */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%', display: 'flex', alignItems: 'flex-end', gap: 38, padding: '0 6%', filter: 'blur(3px)' }}>
        {[
          { w: 54, h: '60%', r: '4px 4px 0 0' },
          { w: 40, h: '42%', r: '20px 20px 0 0' },
          { w: 60, h: '75%', r: '4px 4px 0 0' },
          { w: 36, h: '35%', r: '18px 18px 0 0' },
          { w: 50, h: '55%', r: '4px 4px 0 0' },
          { w: 44, h: '48%', r: '4px 4px 0 0' },
        ].map((s, i) => (
          <div key={i} style={{
            width: s.w, height: s.h, borderRadius: s.r, flexShrink: 0,
            background: `linear-gradient(180deg, ${color.bgElevated}, ${color.bgBase})`,
            opacity: dark ? 0.6 : 0.5,
          }} />
        ))}
      </div>
      {/* fog layer */}
      <div style={{
        position: 'absolute', inset: 0,
        background: dark ? `
          radial-gradient(ellipse 60% 35% at 25% 75%, rgba(236,238,240,0.04) 0%, transparent 70%),
          radial-gradient(ellipse 55% 30% at 78% 55%, rgba(236,238,240,0.03) 0%, transparent 70%)
        ` : `
          radial-gradient(ellipse 60% 35% at 25% 75%, rgba(255,255,255,0.5) 0%, transparent 70%),
          radial-gradient(ellipse 55% 30% at 78% 55%, rgba(255,255,255,0.4) 0%, transparent 70%)
        `,
      }} />
    </div>
  )
}

export default function AuthLayout({ children }) {
  const { color, radius, font, spring } = useTheme()
  return (
    <div style={{
      height: '100dvh', overflow: 'hidden', position: 'relative',
      background: color.bgBase, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflowY: 'auto', padding: 'clamp(12px, 4vw, 32px)' }}>
        <Atmosphere />

        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring.drop}
          className="glass glass-blue"
          style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: 400, margin: 'auto',
            borderRadius: radius.glass,
            padding: 'clamp(24px, 6vw, 36px) clamp(20px, 5vw, 32px)',
          }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <img src={logo} alt="" width={30} height={30} style={{ borderRadius: radius.control, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: color.textPrimary, fontFamily: font.ui, letterSpacing: '-0.01em' }}>
              Vestigio
            </span>
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  )
}
