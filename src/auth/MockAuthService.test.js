import { describe, it, expect, beforeEach, vi } from 'vitest'
import { USERS_KEY, SESSION_KEY } from '../constants/storageKeys.js'

// MockAuthService has module-level state (_demoReady/_demoInit) that only
// runs its setup once per module instance. Each test needs its own fresh
// instance — paired with clearing storage below — so tests can't leak
// into each other via that shared state.
async function freshService() {
  vi.resetModules()
  const mod = await import('./MockAuthService.js')
  return mod.default
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('signUp', () => {
  it('creates a new account without starting a session', async () => {
    const svc = await freshService()
    const user = await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    expect(user.email).toBe('user@example.com')
    expect(user.fullName).toBe('User One')
    expect(user.passwordHash).toBeUndefined()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('rejects a duplicate email', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    await expect(svc.signUp('user@example.com', 'Other5678!', 'User Two')).rejects.toThrow()
  })
})

describe('signIn', () => {
  it('rejects a wrong password', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    await expect(svc.signIn('user@example.com', 'WrongPass1!')).rejects.toThrow()
  })

  it('rejects an unknown email', async () => {
    const svc = await freshService()
    await expect(svc.signIn('nobody@example.com', 'Abcdefg1!')).rejects.toThrow()
  })

  it('returns a session without the password hash on success', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    const session = await svc.signIn('user@example.com', 'Abcdefg1!')
    expect(session.user.email).toBe('user@example.com')
    expect(session.user.passwordHash).toBeUndefined()
  })

  it('signs into the pre-seeded demo account', async () => {
    const svc = await freshService()
    const session = await svc.signIn('julian@archivomuerto.com', 'Demo1234!')
    expect(session.user.fullName).toBe('Julian Archivo')
  })

  it('clears the other store so a stale session cannot collide (regression)', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')

    await svc.signIn('user@example.com', 'Abcdefg1!', true) // remember -> localStorage
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()

    await svc.signIn('user@example.com', 'Abcdefg1!', false) // not remember -> sessionStorage
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('signOut', () => {
  it('clears the session from both stores', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    await svc.signIn('user@example.com', 'Abcdefg1!', true)
    await svc.signOut()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('getSession', () => {
  it('returns null and clears storage once the session has expired', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    await svc.signIn('user@example.com', 'Abcdefg1!', true)

    const stored = JSON.parse(localStorage.getItem(SESSION_KEY))
    stored.expiresAt = Date.now() - 1000
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored))

    const session = await svc.getSession()
    expect(session).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('returns the session while still valid', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    await svc.signIn('user@example.com', 'Abcdefg1!', true)
    const session = await svc.getSession()
    expect(session?.user.email).toBe('user@example.com')
  })
})

describe('resetPassword', () => {
  it('rejects an unknown email', async () => {
    const svc = await freshService()
    await expect(svc.resetPassword('nobody@example.com', 'NewPass1!')).rejects.toThrow()
  })

  it('rejects a Google-only account (no password to reset)', async () => {
    const svc = await freshService()
    await svc.signInWithGoogle({ email: 'g@example.com', name: 'G User', sub: 'abc123' })
    await expect(svc.resetPassword('g@example.com', 'NewPass1!')).rejects.toThrow()
  })

  it('updates the password so the new one works and the old one no longer does', async () => {
    const svc = await freshService()
    await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    await svc.resetPassword('user@example.com', 'NewPass1!')

    await expect(svc.signIn('user@example.com', 'Abcdefg1!')).rejects.toThrow()
    const session = await svc.signIn('user@example.com', 'NewPass1!')
    expect(session.user.email).toBe('user@example.com')
  })
})

describe('exportUsers / importUsers', () => {
  it('restores accounts on a machine that has never seen them', async () => {
    const source = await freshService()
    await source.signUp('moved@example.com', 'Password1!', 'Moved User')
    const exported = JSON.parse(JSON.stringify(await source.exportUsers()))

    localStorage.clear()
    const target = await freshService()
    await target.importUsers(exported)

    const session = await target.signIn('moved@example.com', 'Password1!')
    expect(session.user.id).toBe(exported['moved@example.com'].id)
  })

  it('keeps accounts the backup does not mention, and lets the backup win on a clash', async () => {
    const svc = await freshService()
    await svc.signUp('kept@example.com', 'Password1!', 'Kept')
    await svc.signUp('clash@example.com', 'Password1!', 'Clash')

    await svc.importUsers({ 'clash@example.com': { id: 'user_from_backup', email: 'clash@example.com' } })

    const users = JSON.parse(localStorage.getItem(USERS_KEY))
    expect(users['kept@example.com']).toBeDefined()
    expect(users['clash@example.com'].id).toBe('user_from_backup')
  })

  it('ends a session whose account id just changed, and only that', async () => {
    const svc = await freshService()
    await svc.signUp('me@example.com', 'Password1!', 'Me')
    await svc.signIn('me@example.com', 'Password1!')

    await svc.importUsers({ 'other@example.com': { id: 'x', email: 'other@example.com' } })
    expect(await svc.getSession()).not.toBeNull()

    await svc.importUsers({ 'me@example.com': { id: 'user_from_backup', email: 'me@example.com' } })
    expect(await svc.getSession()).toBeNull()
  })

  it('ignores malformed records', async () => {
    const svc = await freshService()
    await svc.importUsers({ 'bad@example.com': { email: 'bad@example.com' }, 'x@example.com': null })

    const users = JSON.parse(localStorage.getItem(USERS_KEY))
    expect(users['bad@example.com']).toBeUndefined()
    expect(users['x@example.com']).toBeUndefined()
  })
})

describe('signInWithGoogle', () => {
  it('accountExists tells a first sign-in apart, so only that one goes to onboarding', async () => {
    const svc = await freshService()
    const profile = { email: 'New@example.com', name: 'New User', sub: 'n1' }
    expect(await svc.accountExists(profile.email)).toBe(false)
    await svc.signInWithGoogle(profile)
    expect(await svc.accountExists(profile.email)).toBe(true)
  })

  it('creates a local account on first sign-in', async () => {
    const svc = await freshService()
    const session = await svc.signInWithGoogle({ email: 'g@example.com', name: 'G User', sub: 'abc123' })
    expect(session.user.email).toBe('g@example.com')
    expect(session.user.fullName).toBe('G User')
  })

  it('signs into the same account on a repeat sign-in (no duplicate)', async () => {
    const svc = await freshService()
    const first = await svc.signInWithGoogle({ email: 'g@example.com', name: 'G User', sub: 'abc123' })
    const second = await svc.signInWithGoogle({ email: 'g@example.com', name: 'G User', sub: 'abc123' })
    expect(second.user.id).toBe(first.user.id)

    const users = JSON.parse(localStorage.getItem(USERS_KEY))
    expect(Object.keys(users).filter(k => k === 'g@example.com')).toHaveLength(1)
  })

  it('signs into an existing password account with the same email', async () => {
    const svc = await freshService()
    const created = await svc.signUp('user@example.com', 'Abcdefg1!', 'User One')
    const session = await svc.signInWithGoogle({ email: 'user@example.com', name: 'User One', sub: 'xyz789' })
    expect(session.user.id).toBe(created.id)
  })
})
