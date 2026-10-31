import { StrictMode, Component, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import './index.css'
import './i18n/index.js'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { ToastProvider } from './components/Toast.jsx'
import AppRouter from './AppRouter.jsx'
import { hasUnsavedChanges } from './lib/windowCloseGuard.js'
import { migrateLegacyData } from './lib/legacyMigration.js'
import { finishPendingRestore } from './lib/backup.js'
import { isAndroid } from './lib/platform.js'

// ── Close guard ─────────────────────────────────────────────────────
// Blocks a native window close while a modal has unsaved form data, so
// the desktop app can't silently discard it the way a browser tab would.
// No-ops outside the Tauri runtime (e.g. `vite dev` in a plain browser).
function CloseGuard() {
  const { t } = useTranslation()
  useEffect(() => {
    if (!window.__TAURI_INTERNALS__ || isAndroid) return // Android has no window to close
    let unlisten
    let cancelled = false
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().onCloseRequested((event) => {
        if (hasUnsavedChanges() && !window.confirm(t('app.unsavedChangesConfirm'))) {
          event.preventDefault()
        }
      }).then(fn => {
        // This effect can be torn down before the listener finishes
        // registering — drop it here or the close handler runs twice.
        if (cancelled) fn()
        else unlisten = fn
      })
    })
    return () => { cancelled = true; unlisten?.() }
  }, [t])
  return null
}

// ── Error boundary — muestra el error exacto en pantalla ──────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          fontFamily: 'monospace', padding: 32,
          background: '#0E1114', color: '#C97B6E',
          minHeight: '100vh', whiteSpace: 'pre-wrap',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            ❌ Runtime Error — copia esto y reportalo:
          </div>
          <div style={{ fontSize: 13, color: '#ECEEF0' }}>
            {this.state.error?.message}
          </div>
          <div style={{ fontSize: 11, color: '#949CA6', marginTop: 12 }}>
            {this.state.error?.stack}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// The SQLite/filesystem backend only exists inside the Tauri runtime —
// running `npm run dev` in a plain browser has no IPC bridge to call into,
// so this would otherwise hard-crash the app on startup with a cryptic
// IPC error. Skip it there; the real dev loop is `npm run tauri dev`.
if (window.__TAURI_INTERNALS__) {
  // Run before the first render: a failure here must not leave the window
  // blank forever, with no ErrorBoundary mounted yet to report it.
  try {
    await finishPendingRestore()
  } catch (err) {
    console.error('[main] Could not finish restoring a backup:', err)
  }
  try {
    await migrateLegacyData()
  } catch (err) {
    console.error('[main] Legacy data migration failed:', err)
  }
} else {
  console.warn('[main] Not running inside Tauri — skipping SQLite migration. Relic/attachment data will not load. Use `npm run tauri dev`.')
}

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <HashRouter>
            <AuthProvider>
              <ToastProvider>
                <CloseGuard />
                <AppRouter />
              </ToastProvider>
            </AuthProvider>
          </HashRouter>
        </ThemeProvider>
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>
)
