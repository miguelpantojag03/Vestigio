import { describe, it, expect } from 'vitest'
import { getLoginSchema, getRegisterSchema, getForgotSchema, getOnboardingSchema, passwordStrength } from './validators.js'

// These schemas build their messages from t() — a simple identity stub is
// enough since these tests only check pass/fail, not message copy.
const t = (key) => key

describe('getLoginSchema', () => {
  const schema = getLoginSchema(t)

  it('accepts a valid email/password pair', () => {
    const result = schema.safeParse({ email: 'user@example.com', password: 'anything' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = schema.safeParse({ email: 'not-an-email', password: 'anything' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const result = schema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('getRegisterSchema', () => {
  const schema = getRegisterSchema(t)
  const base = {
    fullName: 'Julian Archivo',
    email: 'user@example.com',
    password: 'Abcdefg1!',
    confirmPassword: 'Abcdefg1!',
  }

  it('accepts a fully valid registration', () => {
    expect(schema.safeParse(base).success).toBe(true)
  })

  it('rejects a password missing an uppercase letter', () => {
    const result = schema.safeParse({ ...base, password: 'abcdefg1!', confirmPassword: 'abcdefg1!' })
    expect(result.success).toBe(false)
  })

  it('rejects a password missing a number', () => {
    const result = schema.safeParse({ ...base, password: 'Abcdefgh!', confirmPassword: 'Abcdefgh!' })
    expect(result.success).toBe(false)
  })

  it('rejects a password missing a special character', () => {
    const result = schema.safeParse({ ...base, password: 'Abcdefg12', confirmPassword: 'Abcdefg12' })
    expect(result.success).toBe(false)
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = schema.safeParse({ ...base, password: 'Ab1!', confirmPassword: 'Ab1!' })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched password/confirmPassword', () => {
    const result = schema.safeParse({ ...base, confirmPassword: 'Different1!' })
    expect(result.success).toBe(false)
  })
})

describe('getForgotSchema', () => {
  const schema = getForgotSchema(t)

  it('accepts a valid email with matching strong passwords', () => {
    const result = schema.safeParse({
      email: 'user@example.com', newPassword: 'Abcdefg1!', confirmPassword: 'Abcdefg1!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched newPassword/confirmPassword', () => {
    const result = schema.safeParse({
      email: 'user@example.com', newPassword: 'Abcdefg1!', confirmPassword: 'Other1234!',
    })
    expect(result.success).toBe(false)
  })
})

describe('getOnboardingSchema', () => {
  const schema = getOnboardingSchema(t)

  it('accepts a non-empty project name under the limit', () => {
    expect(schema.safeParse({ projectName: 'Nebula System' }).success).toBe(true)
  })

  it('rejects an empty project name', () => {
    expect(schema.safeParse({ projectName: '' }).success).toBe(false)
  })

  it('rejects a project name over 40 characters', () => {
    expect(schema.safeParse({ projectName: 'x'.repeat(41) }).success).toBe(false)
  })
})

describe('passwordStrength', () => {
  it('scores an empty password as 0', () => {
    expect(passwordStrength('')).toBe(0)
  })

  it('scores a long password with upper/number/special as 4', () => {
    expect(passwordStrength('Abcdefg1!')).toBe(4)
  })

  it('scores a lowercase-only short password as 0', () => {
    expect(passwordStrength('abc')).toBe(0)
  })

  it('gives partial credit for meeting some criteria', () => {
    // length>=8 + has a number, but no uppercase or special char
    expect(passwordStrength('abcdefg1')).toBe(2)
  })
})
