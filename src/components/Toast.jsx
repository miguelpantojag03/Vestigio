import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext.jsx'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const id = useRef(0)

  const dismiss = useCallback((tid) => {
    setToasts(prev => prev.filter(t => t.id !== tid))
  }, [])

  // action: optional { label, onClick } button, e.g. "Undo"
  const push = useCallback((message, type = 'info', duration = 4000, action = null) => {
    const tid = ++id.current
    setToasts(prev => [...prev, { id: tid, message, type, action }])
    if (duration > 0) {
      setTimeout(() => dismiss(tid), duration)
    }
    return tid
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>')
  return ctx
}

function getIcon(type, color) {
  const ICONS = {
    success: <CheckCircle size={15} style={{ color: color.sage500 }} />,
    error:   <AlertCircle size={15} style={{ color: color.terracotta500 }} />,
    info:    <Info        size={15} style={{ color: color.blue300 }} />,
  }
  return ICONS[type] || ICONS.info
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
      }}
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  const { color, radius, font, spring } = useTheme()
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={spring.tap}
      className="glass glass-neutral"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: radius.card,
        color: color.textPrimary,
        fontFamily: font.ui,
        fontSize: 13,
        minWidth: 260,
        maxWidth: 360,
      }}
    >
      {getIcon(toast.type, color)}
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action.onClick(); onDismiss(toast.id) }}
          style={{ color: color.blue300, background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 13, fontWeight: 700, fontFamily: font.ui }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        style={{ color: color.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
      >
        <X size={13} />
      </button>
    </motion.div>
  )
}
