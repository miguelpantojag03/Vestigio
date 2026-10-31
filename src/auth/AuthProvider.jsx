import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import MockAuthService from './MockAuthService.js'
import { getGoogleProfile } from './googleOAuth.js'

// Swap MockAuthService for SupabaseAuthService / FirebaseAuthService here
const authService = MockAuthService

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,   setUser]   = useState(null)
  const [status, setStatus] = useState('loading') // 'loading'|'authenticated'|'unauthenticated'
  // Where GuestRoute sends this sign-in, instead of the default /app. It has
  // to be decided here, before the session changes: the moment it does,
  // GuestRoute redirects, and a navigate() from the page itself loses that race.
  const [postAuthPath, setPostAuthPath] = useState(null)
  const timerRef            = useRef(null)

  // Schedule automatic sign-out when the session expires
  function scheduleExpiry(session, signOutFn) {
    clearTimeout(timerRef.current)
    const msLeft = session.expiresAt - Date.now()
    if (msLeft <= 0) { signOutFn(); return }
    timerRef.current = setTimeout(() => {
      signOutFn()
      // The toast message is emitted from a custom event so any component can listen
      window.dispatchEvent(new CustomEvent('am:session-expired'))
    }, msLeft)
  }

  const doSignOut = useCallback(async () => {
    clearTimeout(timerRef.current)
    setPostAuthPath(null)
    await authService.signOut()
  }, [])

  // Restore session on mount
  useEffect(() => {
    authService.getSession().then(session => {
      if (session) {
        setUser(session.user)
        setStatus('authenticated')
        scheduleExpiry(session, doSignOut)
      } else {
        setStatus('unauthenticated')
      }
    }).catch(err => {
      // Fail closed, not silent-forever: an unreadable session is treated
      // as "not logged in" rather than leaving the app stuck on the
      // loading screen with no way out and no visible error.
      console.error('[AuthProvider] Failed to restore session:', err)
      setStatus('unauthenticated')
    })

    const unsub = authService.onAuthStateChange(session => {
      if (session) {
        setUser(session.user)
        setStatus('authenticated')
        scheduleExpiry(session, doSignOut)
      } else {
        setUser(null)
        setStatus('unauthenticated')
        clearTimeout(timerRef.current)
      }
    })

    return () => { unsub(); clearTimeout(timerRef.current) }
  }, [doSignOut])

  const signIn = useCallback((email, password, remember, nextPath = null) => {
    setPostAuthPath(nextPath)
    return authService.signIn(email, password, remember)
  }, [])

  const signUp = useCallback((email, password, fullName) =>
    authService.signUp(email, password, fullName), [])

  const signInWithGoogle = useCallback(async () => {
    const profile = await getGoogleProfile()
    // A brand-new account takes the same first-run path as a registration.
    const exists = await authService.accountExists(profile.email)
    setPostAuthPath(exists ? null : '/onboarding')
    return authService.signInWithGoogle(profile)
  }, [])

  const signOut      = doSignOut
  const resetPassword = useCallback((email, newPassword) => authService.resetPassword(email, newPassword), [])

  const setActiveProject = useCallback((projectName) => {
    if (!user) return
    return authService.setActiveProject(user.id, projectName)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, status, postAuthPath, signIn, signUp, signInWithGoogle, signOut, resetPassword, setActiveProject }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
