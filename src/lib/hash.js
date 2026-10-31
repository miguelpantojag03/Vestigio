// ─── Password hashing ──────────────────────────────────────────────
// ⚠️  PRODUCTION WARNING: Passwords are stored client-side in
//     localStorage. This protects a copied profile or backup against
//     casual reading, not a real server-side account system.
//
// PBKDF2-HMAC-SHA256 with a random salt per password, via crypto.subtle
// (no dependency). Hashes carry their own parameters, so the iteration
// count can rise later without invalidating existing accounts.
//
// Format: pbkdf2$<iterations>$<salt hex>$<hash hex>

const PBKDF2_ITERATIONS = 210000
const SALT_BYTES = 16
const HASH_BITS = 256
const LEGACY_SALT_PREFIX = 'AM_SALT_2024::'

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], byte => parseInt(byte, 16))
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, HASH_BITS)
  return toHex(new Uint8Array(bits))
}

// The previous format: one fast SHA-256 with the same salt for everyone.
async function legacySha256(password) {
  const encoded = new TextEncoder().encode(LEGACY_SALT_PREFIX + password)
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)))
}

/** @returns {Promise<string>} a self-describing salted hash */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${await derive(password, salt, PBKDF2_ITERATIONS)}`
}

/** Accepts current hashes and the older SHA-256 ones. */
export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false
  if (!storedHash.startsWith('pbkdf2$')) return (await legacySha256(password)) === storedHash
  const [, iterations, saltHex, hash] = storedHash.split('$')
  return (await derive(password, fromHex(saltHex), Number(iterations))) === hash
}

/** True for hashes worth replacing the next time the password is known. */
export function needsRehash(storedHash) {
  return !storedHash?.startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`)
}

// ─── One-time migration helper ─────────────────────────────────────
// The oldest mock used btoa() synchronously, for the demo user only.
const OLD_DEMO_HASH = btoa(unescape(encodeURIComponent(`${LEGACY_SALT_PREFIX}Demo1234!`)))

export async function migrateOldHash(userRecord) {
  if (userRecord.passwordHash === OLD_DEMO_HASH) {
    userRecord.passwordHash = await hashPassword('Demo1234!')
    userRecord.__hashVersion = 2
  }
  return userRecord
}
