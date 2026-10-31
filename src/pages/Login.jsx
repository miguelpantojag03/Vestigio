import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import {
  Field, Input, PasswordInput, PrimaryButton,
  GlobalError, Divider, Spinner,
} from '../components/FormField.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useToast } from '../components/Toast.jsx'
import { getLoginSchema } from '../lib/validators.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { isAndroid } from '../lib/platform.js'

export default function Login() {
  const { t }      = useTranslation()
  const { color, radius, font } = useTheme()
  const { signIn, signInWithGoogle } = useAuth()
  const { push }   = useToast()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from?.pathname || '/app'

  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const loginSchema = useMemo(() => getLoginSchema(t), [t])
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  async function onSubmit(data) {
    setGlobalError('')
    setLoading(true)
    try {
      await signIn(data.email, data.password, data.remember)
      push(t('auth.login.welcomeToast'), 'success')
      navigate(from, { replace: true })
    } catch (err) {
      setGlobalError(err.message === 'Invalid email or password.' ? t('auth.login.errorInvalidCredentials') : err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    try {
      await signInWithGoogle() // GuestRoute takes it from here, onboarding included
      push(t('auth.login.welcomeToast'), 'success')
    } catch (err) {
      console.error('[Google sign-in]', err.code, err.message, err)
      const msg = {
        denied: t('auth.login.googleErrorDenied'),
        timeout: t('auth.login.googleErrorTimeout'),
        network: t('auth.login.googleErrorNetwork'),
      }[err.code] ?? t('auth.login.googleErrorGeneric')
      push(msg, 'error')
    } finally {
      setGoogleLoading(false)
    }
  }

  function fillDemo() {
    setValue('email', 'julian@archivomuerto.com')
    setValue('password', 'Demo1234!')
    setValue('remember', true)
  }

  return (
    <AuthLayout>
      {/* Header */}
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 26, fontWeight: 500, fontFamily: font.display, color: color.textPrimary, marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {t('auth.login.title')}
        </h1>
        <p style={{ fontSize: 13, color: color.textSecondary, fontFamily: font.ui, lineHeight: 1.5 }}>
          {t('auth.login.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <Field label={t('auth.login.emailLabel')} error={errors.email?.message}>
          <Input
            register={register('email')}
            type="email"
            placeholder={t('auth.login.emailPlaceholder')}
            autoComplete="email"
            error={errors.email}
          />
        </Field>

        <Field label={t('auth.login.passwordLabel')} error={errors.password?.message}>
          <PasswordInput
            register={register('password')}
            placeholder={t('auth.login.passwordPlaceholder')}
            autoComplete="current-password"
            error={errors.password}
          />
        </Field>

        {/* Remember me + forgot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: color.textSecondary, fontFamily: font.ui }}>
            <input
              type="checkbox"
              {...register('remember')}
              style={{ accentColor: color.blue500, width: 14, height: 14 }}
            />
            {t('auth.login.remember')}
          </label>
          <Link
            to="/forgot-password"
            style={{ fontSize: 12, color: color.blue300, textDecoration: 'none', fontFamily: font.ui, transition: 'color 0.15s' }}
            onMouseEnter={e => e.target.style.color = color.textPrimary}
            onMouseLeave={e => e.target.style.color = color.blue300}
          >
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        <GlobalError message={globalError} />

        <PrimaryButton loading={loading} disabled={loading || googleLoading}>
          {loading ? t('auth.login.submitting') : t('auth.login.submit')}
        </PrimaryButton>

        {/* Google sign-in — opens the system browser, real OAuth. Not on Android:
            it needs a local loopback server, which Google doesn't accept there. */}
        {!isAndroid && <>
        <Divider label={t('auth.login.or')} />

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          style={{
            width: '100%', padding: '9px 0', borderRadius: radius.control,
            background: 'transparent', border: `1px solid ${color.bgBorder}`,
            color: color.textPrimary, fontSize: 13, fontWeight: 500,
            fontFamily: font.ui, cursor: (googleLoading || loading) ? 'not-allowed' : 'pointer',
            opacity: (googleLoading || loading) ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = color.blue500}
          onMouseLeave={e => e.currentTarget.style.borderColor = color.bgBorder}
        >
          {googleLoading ? (
            <Spinner color={color.textSecondary} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {googleLoading ? t('auth.login.googleButtonLoading') : t('auth.login.googleButton')}
        </button>
        </>}

        {/* Demo account fill — development only: credentials don't belong on a shipped login screen */}
        {import.meta.env.DEV && <button
          type="button"
          onClick={fillDemo}
          style={{
            width: '100%', padding: '7px 0', borderRadius: radius.control,
            background: alpha(color.blue500, 0.08), border: `1px solid ${alpha(color.blue500, 0.25)}`,
            color: color.blue300, fontSize: 12, fontWeight: 500,
            fontFamily: font.ui, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = alpha(color.blue500, 0.15)}
          onMouseLeave={e => e.currentTarget.style.background = alpha(color.blue500, 0.08)}
        >
          {t('auth.login.demoButton')}
        </button>}

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: color.textSecondary, fontFamily: font.ui, marginTop: 4 }}>
          {t('auth.login.noAccount')}{' '}
          <Link
            to="/register"
            style={{ color: color.blue300, textDecoration: 'none', fontWeight: 600 }}
          >
            {t('auth.login.createAccount')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
