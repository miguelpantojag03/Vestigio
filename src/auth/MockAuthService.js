// ─── MockAuthService ───────────────────────────────────────────────
// ⚠️  PRODUCTION WARNING: This is a LOCAL mock that stores data in
//     the browser's localStorage. NEVER use this in production.
//     Replace with a real backend (Supabase, Firebase, custom API)
//     that handles auth server-side with secure password hashing.

import { hashPassword, verifyPassword, migrateOldHash } from '../lib/hash.js'
import { storageGetLocal, storageSetLocal }              from '../lib/storage.js'
import { USERS_KEY, SESSION_KEY }                        from '../constants/storageKeys.js'

const SESSION_DAYS = 7

// ── Demo user ──────────────────────────────────────────────────────
const DEMO_USER = {
  id:                    'user_demo_001',
  email:                 'julian@archivomuerto.com',
  fullName:              'Julian Archivo',
  avatarInitials:        'JA',
  activeProject:         'Nebula System',
  activeProjectInitials: 'NS',
}

// ensureDemoUser runs ONCE at module initialisation, not on every call.
let _demoReady = false
async function ensureDemoUser() {
  if (_demoReady) return
  _demoReady = true
  const users = storageGetLocal(USERS_KEY) || {}
  if (!users[DEMO_USER.email]) {
    users[DEMO_USER.email] = {
      ...DEMO_USER,
      passwordHash:  await hashPassword('Demo1234!'),
      __hashVersion: 2,
    }
    storageSetLocal(USERS_KEY, users)
  } else {
    // Migrate old btoa hash if needed
    const migrated = await migrateOldHash(users[DEMO_USER.email])
    if (migrated.__hashVersion === 2) {
      users[DEMO_USER.email] = migrated
      storageSetLocal(USERS_KEY, users)
    }
  }
}

// Kick off immediately (fire-and-forget — awaited inside methods)
const _demoInit = ensureDemoUser()

// ── Helpers ────────────────────────────────────────────────────────
function delay(ms = 600) { return new Promise(r => setTimeout(r, ms)) }

function makeInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function makeSession(user, persistent) {
  return {
    user,
    expiresAt:  Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    persistent,
  }
}

// ── Auth state listeners ───────────────────────────────────────────
const listeners = new Set()
function notifyListeners(session) { listeners.forEach(fn => fn(session)) }

// ── Public API ─────────────────────────────────────────────────────
const MockAuthService = {

  async signIn(email, password, remember = true) {
    await _demoInit           // ensure demo user is ready
    await delay()
    const users  = storageGetLocal(USERS_KEY) || {}
    const record = users[email.toLowerCase()]
    if (!record || !(await verifyPassword(password, record.passwordHash))) {
      throw new Error('Invalid email or password.')
    }
    const { passwordHash: _, __hashVersion: __, ...user } = record
    const session = makeSession(user, remember)
    const store   = remember ? localStorage : sessionStorage
    const other   = remember ? sessionStorage : localStorage
    // Clear whichever store isn't the chosen one — otherwise a stale
    // session left there can outrank this one (getSession reads
    // localStorage first) or get collaterally wiped if it's expired.
    other.removeItem(SESSION_KEY)
    store.setItem(SESSION_KEY, JSON.stringify(session))
    notifyListeners(session)
    return session
  },

  async signUp(email, password, fullName) {
    await _demoInit
    await delay()
    const users = storageGetLocal(USERS_KEY) || {}
    const key   = email.toLowerCase()
    if (users[key]) throw new Error('An account with this email already exists.')
    const user = {
      id:                    `user_${Date.now()}`,
      email:                 key,
      fullName,
      avatarInitials:        makeInitials(fullName),
      activeProject:         '',
      activeProjectInitials: '',
    }
    users[key] = { ...user, passwordHash: await hashPassword(password), __hashVersion: 2 }
    storageSetLocal(USERS_KEY, users)
    // Return user — NO session yet (onboarding will create it via signIn)
    return user
  },

  // profile comes from googleOAuth.js's getGoogleProfile() — Google only
  // confirms identity here, this just finds-or-creates the matching local
  // account exactly like any password account, keyed by the same email.
  async signInWithGoogle(profile) {
    await _demoInit
    const users = storageGetLocal(USERS_KEY) || {}
    const key   = profile.email.toLowerCase()
    let record  = users[key]
    const isNew = !record
    if (isNew) {
      record = {
        id:                    `user_google_${profile.sub}`,
        email:                 key,
        fullName:              profile.name,
        avatarInitials:        makeInitials(profile.name),
        activeProject:         '',
        activeProjectInitials: '',
        provider:              'google', // no passwordHash/__hashVersion — doesn't sign in by password
      }
      users[key] = record
      storageSetLocal(USERS_KEY, users)
    }
    // If an account with this email already exists (e.g. created with a
    // password earlier), sign into that same account — email is already
    // the de facto unique identity key in this system.
    const { passwordHash: _, __hashVersion: __, ...user } = record
    const session = makeSession(user, true) // persistent — no "remember me" concept in OAuth
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    notifyListeners(session)
    return { ...session, isNew }
  },

  async signOut() {
    await delay(150)
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    notifyListeners(null)
  },

  async getSession() {
    await _demoInit
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      const session = JSON.parse(raw)
      if (Date.now() > session.expiresAt) {
        // Expired — clean up and return null so AuthProvider can redirect
        localStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(SESSION_KEY)
        return null
      }
      return session
    } catch { return null }
  },

  // There's no real backend or email delivery here, so pretending to
  // "send a reset link" would just be a dead end for the user. Instead
  // this sets the new password directly on the matching local account.
  async resetPassword(email, newPassword) {
    await _demoInit
    await delay()
    const users  = storageGetLocal(USERS_KEY) || {}
    const key    = email.toLowerCase()
    const record = users[key]
    if (!record) throw new Error('No account found with that email.')
    if (!record.passwordHash) throw new Error('This account signs in with Google — there is no password to reset.')
    record.passwordHash  = await hashPassword(newPassword)
    record.__hashVersion = 2
    users[key] = record
    storageSetLocal(USERS_KEY, users)
    return true
  },

  async setActiveProject(userId, projectName) {
    await _demoInit
    const users  = storageGetLocal(USERS_KEY) || {}
    const record = Object.values(users).find(u => u.id === userId)
    if (!record) return
    const initials = makeInitials(projectName)
    record.activeProject         = projectName
    record.activeProjectInitials = initials
    users[record.email]          = record
    storageSetLocal(USERS_KEY, users)
    // Patch live session
    const rawLS = localStorage.getItem(SESSION_KEY)
    const rawSS = sessionStorage.getItem(SESSION_KEY)
    const raw   = rawLS || rawSS
    if (raw) {
      const session = JSON.parse(raw)
      session.user.activeProject         = projectName
      session.user.activeProjectInitials = initials
      const store = rawLS ? localStorage : sessionStorage
      store.setItem(SESSION_KEY, JSON.stringify(session))
      notifyListeners(session)
    }
  },

  // Backups carry the accounts: the relics in a restored database belong to
  // these user ids, and a fresh machine wouldn't know them otherwise.
  async exportUsers() {
    await _demoInit
    return storageGetLocal(USERS_KEY) || {}
  },

  // The backup's record wins over a same-email account here, since that's the
  // id its relics are stored under. Accounts it doesn't mention are kept.
  async importUsers(restored) {
    await _demoInit
    const users = storageGetLocal(USERS_KEY) || {}
    for (const [key, record] of Object.entries(restored ?? {})) {
      if (record?.id && record.email === key) users[key] = record
    }
    storageSetLocal(USERS_KEY, users)
    // A session under an id that just stopped being that account's would log
    // into an empty archive; better to ask for a sign-in.
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      let session = null
      try { session = JSON.parse(raw) } catch { /* treated as stale below */ }
      if (users[session?.user?.email]?.id !== session?.user?.id || !session) {
        localStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
  },

  onAuthStateChange(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
}

export default MockAuthService
