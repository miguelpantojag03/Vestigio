import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowLeft } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import { Field, Input, PasswordInput, PrimaryButton, GlobalError } from '../components/FormField.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getForgotSchema } from '../lib/validators.js'
import { useTheme } from '../context/ThemeContext.jsx'

export default function ForgotPassword() {
  const { t }      = useTranslation()
  const { color, font } = useTheme()
  const { resetPassword } = useAuth()
  const [sent, setSent]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')

  const forgotSchema = useMemo(() => getForgotSchema(t), [t])
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '', newPassword: '', confirmPassword: '' },
  })

  // There's no real backend or email delivery in this local-first app, so
  // this sets the new password directly instead of pretending to email a
  // reset link that would never actually arrive.
  async function onSubmit(data) {
    setGlobalError('')
    setLoading(true)
    try {
      await resetPassword(data.email, data.newPassword)
      setSent(true)
    } catch (err) {
      const known = {
        'No account found with that email.': t('auth.forgotPassword.errorNoAccount'),
        'This account signs in with Google — there is no password to reset.': t('auth.forgotPassword.errorGoogleOnly'),
      }
      setGlobalError(known[err.message] ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {sent ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '12px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(53,112,72,0.1)', border: '1px solid rgba(53,112,72,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={26} style={{ color: color.sage500 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, fontFamily: font.display, color: color.textPrimary, marginBottom: 8 }}>
              {t('auth.forgotPassword.sentTitle')}
            </h2>
            <p style={{ fontSize: 13, color: color.textSecondary, lineHeight: 1.6 }}>
              {t('auth.forgotPassword.sentMessage')}
            </p>
          </div>
          <Link
            to="/login"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: color.blue300, textDecoration: 'none', marginTop: 8,
            }}
          >
            <ArrowLeft size={14} /> {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 500, fontFamily: font.display, color: color.textPrimary, marginBottom: 6, letterSpacing: '-0.02em' }}>
              {t('auth.forgotPassword.title')}
            </h1>
            <p style={{ fontSize: 13, color: color.textSecondary }}>
              {t('auth.forgotPassword.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={t('auth.forgotPassword.emailLabel')} error={errors.email?.message}>
              <Input
                register={register('email')}
                type="email"
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                autoComplete="email"
                error={errors.email}
              />
            </Field>

            <Field label={t('auth.forgotPassword.newPasswordLabel')} error={errors.newPassword?.message}>
              <PasswordInput register={register('newPassword')} placeholder={t('auth.forgotPassword.newPasswordPlaceholder')}
                autoComplete="new-password" error={errors.newPassword} />
            </Field>

            <Field label={t('auth.forgotPassword.confirmPasswordLabel')} error={errors.confirmPassword?.message}>
              <PasswordInput register={register('confirmPassword')} placeholder={t('auth.forgotPassword.confirmPasswordPlaceholder')}
                autoComplete="new-password" error={errors.confirmPassword} />
            </Field>

            <GlobalError message={globalError} />

            <PrimaryButton loading={loading}>
              {loading ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
            </PrimaryButton>

            <Link
              to="/login"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 12, color: color.textSecondary, textDecoration: 'none', marginTop: 4,
              }}
            >
              <ArrowLeft size={13} /> {t('auth.forgotPassword.backToSignIn')}
            </Link>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
