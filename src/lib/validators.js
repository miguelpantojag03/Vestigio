import { z } from 'zod'

// Schemas are factories so their error messages can be built from t()
// (translation keys resolve to the active language at call time).

export function getLoginSchema(t) {
  return z.object({
    email: z.string().min(1, t('auth.validation.emailRequired')).email(t('auth.validation.emailInvalid')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
    remember: z.boolean().optional(),
  })
}

export function getRegisterSchema(t) {
  return z.object({
    fullName: z.string().min(2, t('auth.validation.nameMin')),
    email: z.string().min(1, t('auth.validation.emailRequired')).email(t('auth.validation.emailInvalid')),
    password: z
      .string()
      .min(8, t('auth.validation.passwordMin'))
      .regex(/[A-Z]/, t('auth.validation.passwordUppercase'))
      .regex(/[0-9]/, t('auth.validation.passwordNumber'))
      .regex(/[^A-Za-z0-9]/, t('auth.validation.passwordSpecial')),
    confirmPassword: z.string().min(1, t('auth.validation.confirmRequired')),
  }).refine(d => d.password === d.confirmPassword, {
    message: t('auth.validation.passwordsMismatch'),
    path: ['confirmPassword'],
  })
}

export function getForgotSchema(t) {
  return z.object({
    email: z.string().min(1, t('auth.validation.emailRequired')).email(t('auth.validation.emailInvalid')),
    newPassword: z
      .string()
      .min(8, t('auth.validation.passwordMin'))
      .regex(/[A-Z]/, t('auth.validation.passwordUppercase'))
      .regex(/[0-9]/, t('auth.validation.passwordNumber'))
      .regex(/[^A-Za-z0-9]/, t('auth.validation.passwordSpecial')),
    confirmPassword: z.string().min(1, t('auth.validation.confirmRequired')),
  }).refine(d => d.newPassword === d.confirmPassword, {
    message: t('auth.validation.passwordsMismatch'),
    path: ['confirmPassword'],
  })
}

export function getOnboardingSchema(t) {
  return z.object({
    projectName: z.string().trim().min(1, t('auth.validation.projectNameRequired')).max(40),
  })
}

export function passwordStrength(password) {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}
