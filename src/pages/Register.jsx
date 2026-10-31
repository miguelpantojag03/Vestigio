import { useState, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import {
  Field, Input, PasswordInput, PrimaryButton, GlobalError,
} from '../components/FormField.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useToast } from '../components/Toast.jsx'
import { getRegisterSchema, passwordStrength } from '../lib/validators.js'
import { useTheme } from '../context/ThemeContext.jsx'

const STRENGTH_KEYS = ['tooWeak', 'weak', 'fair', 'strong']

function PasswordStrengthMeter({ password }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const STRENGTH_COLORS = [color.terracotta500, '#E08855', '#E0C855', color.sage500]
  const score = passwordStrength(password || '')
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i < score ? STRENGTH_COLORS[score - 1] : color.bgBorder,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      {password && score > 0 && (
        <span style={{ fontSize: 10, color: STRENGTH_COLORS[score - 1], marginTop: 3, display: 'block' }}>
          {t(`auth.register.strength.${STRENGTH_KEYS[score - 1]}`)}
        </span>
      )}
    </div>
  )
}

export default function Register() {
  const { t }      = useTranslation()
  const { color, font } = useTheme()
  const { signUp, signIn }    = useAuth()
  const { push }              = useToast()
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading]         = useState(false)

  const registerSchema = useMemo(() => getRegisterSchema(t), [t])
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const password = useWatch({ control, name: 'password' })

  async function onSubmit(data) {
    setGlobalError('')
    setLoading(true)
    try {
      // 1. Create account
      await signUp(data.email, data.password, data.fullName)
      // 2. Sign in immediately; GuestRoute then takes the new account to onboarding
      await signIn(data.email, data.password, true, '/onboarding')
      push(t('auth.register.successToast'), 'success')
    } catch (err) {
      setGlobalError(
        err.message === 'An account with this email already exists.'
          ? t('auth.register.errorEmailExists')
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, fontFamily: font.display, color: color.textPrimary, marginBottom: 6, letterSpacing: '-0.01em' }}>
          {t('auth.register.title')}
        </h1>
        <p style={{ fontSize: 13, color: color.textSecondary }}>
          {t('auth.register.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <Field label={t('auth.register.fullNameLabel')} error={errors.fullName?.message}>
          <Input register={register('fullName')} type="text" placeholder={t('auth.register.fullNamePlaceholder')}
            autoComplete="name" error={errors.fullName} />
        </Field>

        <Field label={t('auth.register.emailLabel')} error={errors.email?.message}>
          <Input register={register('email')} type="email" placeholder={t('auth.register.emailPlaceholder')}
            autoComplete="email" error={errors.email} />
        </Field>

        <Field label={t('auth.register.passwordLabel')} error={errors.password?.message}>
          <PasswordInput register={register('password')} placeholder={t('auth.register.passwordPlaceholder')}
            autoComplete="new-password" error={errors.password} />
          <PasswordStrengthMeter password={password} />
        </Field>

        <Field label={t('auth.register.confirmPasswordLabel')} error={errors.confirmPassword?.message}>
          <PasswordInput register={register('confirmPassword')} placeholder={t('auth.register.confirmPasswordPlaceholder')}
            autoComplete="new-password" error={errors.confirmPassword} />
        </Field>

        <GlobalError message={globalError} />

        <PrimaryButton loading={loading}>
          {loading ? t('auth.register.submitting') : t('auth.register.submit')}
        </PrimaryButton>

        <p style={{ textAlign: 'center', fontSize: 12, color: color.textSecondary, marginTop: 4 }}>
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" style={{ color: color.blue300, textDecoration: 'none', fontWeight: 600 }}>
            {t('auth.register.signIn')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
