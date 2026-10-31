import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, migrateOldHash, needsRehash } from './hash.js'

async function legacyHash(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`AM_SALT_2024::${password}`))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('hashPassword / verifyPassword', () => {
  it('salts every hash, so equal passwords do not produce equal hashes', async () => {
    const a = await hashPassword('Demo1234!')
    const b = await hashPassword('Demo1234!')
    expect(a).not.toBe(b)
    expect(await verifyPassword('Demo1234!', a)).toBe(true)
    expect(await verifyPassword('Demo1234!', b)).toBe(true)
  })

  it('never stores the password', async () => {
    expect(await hashPassword('Demo1234!')).not.toContain('Demo1234!')
  })

  it('verifyPassword returns false for a wrong password', async () => {
    const hash = await hashPassword('Demo1234!')
    expect(await verifyPassword('WrongPass1!', hash)).toBe(false)
  })

  it('verifyPassword returns false for an account with no password', async () => {
    expect(await verifyPassword('anything', undefined)).toBe(false)
  })

  it('still verifies hashes from before the change', async () => {
    const old = await legacyHash('Demo1234!')
    expect(await verifyPassword('Demo1234!', old)).toBe(true)
    expect(await verifyPassword('WrongPass1!', old)).toBe(false)
  })
})

describe('needsRehash', () => {
  it('flags old hashes and passes current ones', async () => {
    expect(needsRehash(await legacyHash('Demo1234!'))).toBe(true)
    expect(needsRehash(await hashPassword('Demo1234!'))).toBe(false)
  })

  it('flags hashes made with fewer iterations', () => {
    expect(needsRehash('pbkdf2$1000$00$00')).toBe(true)
  })
})

describe('migrateOldHash', () => {
  it('upgrades a record with the legacy btoa hash', async () => {
    const record = { passwordHash: btoa(unescape(encodeURIComponent('AM_SALT_2024::Demo1234!'))) }
    const migrated = await migrateOldHash(record)
    expect(migrated.__hashVersion).toBe(2)
    expect(await verifyPassword('Demo1234!', migrated.passwordHash)).toBe(true)
  })

  it('leaves any other record untouched', async () => {
    const record = { passwordHash: 'already-sha256-hex', __hashVersion: 2 }
    const migrated = await migrateOldHash(record)
    expect(migrated.passwordHash).toBe('already-sha256-hex')
  })
})
