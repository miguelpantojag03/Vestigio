import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import { Field, Input, PrimaryButton, GlobalError } from '../components/FormField.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useToast } from '../components/Toast.jsx'
import { getOnboardingSchema } from '../lib/validators.js'
import { createProject } from '../lib/projectStorage.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

export default function Onboarding() {
  const { t }      = useTranslation()
  const { color, radius, font } = useTheme()
  // Register now signs in BEFORE navigating here, so AuthProvider already
  // has the authenticated user — setActiveProject reads it internally.
  const { user, setActiveProject } = useAuth()
  const { push }             = useToast()
  const navigate              = useNavigate()

  const [loading, setLoading]         = useState(false)
  const [globalError, setGlobalError] = useState('')

  const onboardingSchema = useMemo(() => getOnboardingSchema(t), [t])
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { projectName: '' },
  })

  async function onSubmit(data) {
    setGlobalError('')
    setLoading(true)
    try {
      await setActiveProject(data.projectName)
      if (user?.id) await createProject(user.id, data.projectName)
      push(t('auth.onboarding.successToast'), 'success')
      navigate('/app', { replace: true })
    } catch (err) {
      setGlobalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: radius.card,
          background: alpha(color.blue500, 0.15), border: `1px solid ${alpha(color.blue500, 0.3)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={26} style={{ color: color.blue300 }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, fontFamily: font.display, color: color.textPrimary, marginBottom: 6, letterSpacing: '-0.02em' }}>
            {t('auth.onboarding.title')}
          </h1>
          <p style={{ fontSize: 13, color: color.textSecondary, lineHeight: 1.6 }}>
            {t('auth.onboarding.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          <Field label={t('auth.onboarding.projectNameLabel')} error={errors.projectName?.message}>
            <Input register={register('projectName')} type="text"
              placeholder={t('auth.onboarding.projectNamePlaceholder')} autoComplete="off" error={errors.projectName} />
          </Field>

          <GlobalError message={globalError} />

          <PrimaryButton loading={loading}>
            {loading ? t('auth.onboarding.submitting') : t('auth.onboarding.submit')}
          </PrimaryButton>
        </form>
      </div>
    </AuthLayout>
  )
}
