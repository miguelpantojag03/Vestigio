import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { palettes, font, radius, spring } from '../styles/tokens.js'
import { THEME_KEY } from '../constants/storageKeys.js'

const ThemeContext = createContext(null)

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function readStoredMode() {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'dark'
  } catch { return 'dark' }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState]   = useState(readStoredMode)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Track OS theme changes while in 'auto' mode
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const handler = e => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode

  // Stamp data-theme on <html> so plain-CSS surfaces (scrollbar, glass
  // utility classes in index.css) can react too, not just inline styles.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  const setMode = useCallback((next) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (document.startViewTransition && !reduced) {
      document.startViewTransition(() => flushSync(() => setModeState(next)))
    } else {
      setModeState(next)
    }
    // Best-effort persistence — private browsing / storage-disabled shouldn't block theme switching
    try { localStorage.setItem(THEME_KEY, next) } catch { /* ignored */ }
  }, [])

  const value = useMemo(() => ({
    mode, resolvedTheme, setMode,
    color: palettes[resolvedTheme],
    font, radius, spring,
  }), [mode, resolvedTheme, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
