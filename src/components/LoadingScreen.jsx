import { useTranslation } from 'react-i18next'
import { useTheme } from '../context/ThemeContext.jsx'

export default function LoadingScreen() {
  const { t } = useTranslation()
  const { color } = useTheme()
  return (
    <div
      className="flex items-center justify-center"
      style={{ height: '100dvh', background: color.bgSurface }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Logo with pulse */}
        <div
          style={{
            width: 48,
            height: 48,
            background: color.blue500,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'am-pulse 1.4s ease-in-out infinite',
          }}
        >
          <svg viewBox="0 0 20 20" width="28" height="28" fill="none">
            <rect x="3" y="3" width="6" height="6" rx="1.5" fill="white" opacity="0.9" />
            <rect x="11" y="3" width="6" height="6" rx="1.5" fill="white" opacity="0.6" />
            <rect x="3" y="11" width="6" height="6" rx="1.5" fill="white" opacity="0.6" />
            <rect x="11" y="11" width="6" height="6" rx="1.5" fill="white" opacity="0.3" />
          </svg>
        </div>
        <span style={{ color: color.textSecondary, fontSize: 13, letterSpacing: '0.05em' }}>
          {t('loadingScreen.loading')}
        </span>
      </div>
      <style>{`
        @keyframes am-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(0.92); }
        }
      `}</style>
    </div>
  )
}
