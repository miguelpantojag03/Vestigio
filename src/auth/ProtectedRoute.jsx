import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'

// Protects /app – redirects unauthenticated users to /login with return path
export function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location   = useLocation()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

// Prevents authenticated users from visiting /login, /register, etc.
export function GuestRoute({ children }) {
  const { status, postAuthPath } = useAuth()
  if (status === 'loading') return <LoadingScreen />
  if (status === 'authenticated') return <Navigate to={postAuthPath ?? '/app'} replace />
  return children
}
