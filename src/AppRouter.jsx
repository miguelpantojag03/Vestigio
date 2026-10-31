import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, GuestRoute } from './auth/ProtectedRoute.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'

// Split by route: a signed-in person never needs the auth pages, and vice versa
const Login          = lazy(() => import('./pages/Login.jsx'))
const Register       = lazy(() => import('./pages/Register.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const Onboarding     = lazy(() => import('./pages/Onboarding.jsx'))
const Dashboard      = lazy(() => import('./pages/Dashboard.jsx'))

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      {/* Guest-only: redirect to /app if already authenticated */}
      <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register"        element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

      {/* Onboarding — requires auth (Register now signs in before navigating here) */}
      <Route path="/onboarding"      element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      {/* Protected app */}
      <Route path="/app"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/* Default */}
      <Route path="*"                element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  )
}
