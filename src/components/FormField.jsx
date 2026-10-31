import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

// Generic text/email input with label + inline error
export function Field({ label, error, children, hint }) {
  const { color, font } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: color.textSecondary, letterSpacing: '0.01em', fontFamily: font.ui }}>
        {label}
      </label>
      {children}
      {error && (
        <span
          role="alert"
          aria-live="polite"
          style={{ fontSize: 11, color: color.terracotta500, marginTop: 1, fontFamily: font.ui }}
        >
          {error}
        </span>
      )}
      {hint && !error && (
        <span style={{ fontSize: 11, color: color.textTertiary, marginTop: 1, fontFamily: font.ui }}>{hint}</span>
      )}
    </div>
  )
}

export function Input({ register, error, ...props }) {
  const { color, radius, font } = useTheme()
  const inputBase = {
    width: '100%', padding: '9px 12px', borderRadius: radius.control,
    background: alpha(color.bgBase, 0.04), border: `1px solid ${color.bgBorder}`,
    color: color.textPrimary, fontSize: 13, fontFamily: font.ui, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  return (
    <input
      {...register}
      {...props}
      aria-invalid={!!error}
      style={{
        ...inputBase,
        borderColor: error ? color.terracotta500 : color.bgBorder,
      }}
      onFocus={e => {
        e.target.style.borderColor = error ? color.terracotta500 : color.blue500
        e.target.style.boxShadow = `0 0 0 3px ${error ? alpha(color.terracotta500, 0.16) : alpha(color.blue500, 0.18)}`
      }}
      onBlur={e => { e.target.style.borderColor = error ? color.terracotta500 : color.bgBorder; e.target.style.boxShadow = 'none' }}
    />
  )
}

export function PasswordInput({ register, error, ...props }) {
  const { color, radius, font } = useTheme()
  const [show, setShow] = useState(false)
  const inputBase = {
    width: '100%', padding: '9px 12px', borderRadius: radius.control,
    background: alpha(color.bgBase, 0.04), border: `1px solid ${color.bgBorder}`,
    color: color.textPrimary, fontSize: 13, fontFamily: font.ui, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...register}
        {...props}
        type={show ? 'text' : 'password'}
        aria-invalid={!!error}
        style={{
          ...inputBase,
          paddingRight: 40,
          borderColor: error ? color.terracotta500 : color.bgBorder,
        }}
        onFocus={e => {
          e.target.style.borderColor = error ? color.terracotta500 : color.blue500
          e.target.style.boxShadow = `0 0 0 3px ${error ? alpha(color.terracotta500, 0.16) : alpha(color.blue500, 0.18)}`
        }}
        onBlur={e => { e.target.style.borderColor = error ? color.terracotta500 : color.bgBorder; e.target.style.boxShadow = 'none' }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: color.textSecondary, padding: 2,
        }}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

export function PrimaryButton({ loading, children, ...props }) {
  const { color, radius, font, spring } = useTheme()
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={loading ? {} : { scale: 0.97 }}
      transition={spring.tap}
      {...props}
      style={{
        width: '100%',
        padding: '10px 0',
        borderRadius: radius.control,
        background: loading ? color.blue600 : color.blue500,
        color: color.onPrimary,
        fontWeight: 700,
        fontSize: 14,
        fontFamily: font.ui,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  )
}

export function GlobalError({ message }) {
  const { color, radius, font } = useTheme()
  if (!message) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: '8px 12px',
        borderRadius: radius.controlXs,
        background: alpha(color.terracotta500, 0.1),
        border: `1px solid ${alpha(color.terracotta500, 0.3)}`,
        color: color.terracotta300,
        fontSize: 12,
        fontFamily: font.ui,
        marginBottom: 4,
      }}
    >
      {message}
    </div>
  )
}

export function Divider({ label }) {
  const { color, font } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: color.bgBorder }} />
      <span style={{ fontSize: 11, color: color.textTertiary, fontFamily: font.ui }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: color.bgBorder }} />
    </div>
  )
}

export function Spinner({ color: strokeColor } = {}) {
  const { color } = useTheme()
  const stroke = strokeColor ?? color.onPrimary // default matches PrimaryButton's filled background
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none"
      className="am-spin"
    >
      <circle cx="12" cy="12" r="10" stroke={stroke} strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
