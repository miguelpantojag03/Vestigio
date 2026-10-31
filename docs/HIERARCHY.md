# Vestigio — Jerarquía del proyecto

```
archivo-muerto/
│
├── index.html                        # Entry point HTML (Google Fonts, div#app)
├── vite.config.js                    # Vite + @vitejs/plugin-react + @tailwindcss/vite
├── package.json                      # Scripts: dev · build · preview
├── tsconfig.json                     # Configuración TS heredada (no usada en build)
│
├── docs/                             # ← Esta carpeta
│   ├── DOCUMENTATION.md              # Documentación técnica completa
│   ├── HIERARCHY.md                  # Este archivo
│   └── NAVIGATION.md                 # Mapa de rutas y flujos
│
└── src/
    │
    ├── main.jsx                      # Root: MotionConfig > ThemeProvider > HashRouter > AuthProvider > ToastProvider > AppRouter
    ├── AppRouter.jsx                 # Definición de rutas con React Router
    ├── index.css                     # Reset global + tokens CSS + scrollbar + placeholder
    │
    ├── auth/                         # Capa de autenticación (intercambiable)
    │   ├── AuthService.js            # Interfaz / contrato documentado (JSDoc)
    │   ├── MockAuthService.js        # Implementación mock con localStorage (~600ms latencia)
    │   ├── AuthProvider.jsx          # Context: user · status · signIn · signUp · signOut …
    │   └── ProtectedRoute.jsx        # <ProtectedRoute> y <GuestRoute>
    │
    ├── pages/                        # Vistas de nivel de ruta
    │   ├── Login.jsx                 # /login  — form, demo fill, Google visual
    │   ├── Register.jsx              # /register — form + medidor de contraseña
    │   ├── ForgotPassword.jsx        # /forgot-password — form + estado de éxito
    │   ├── Onboarding.jsx            # /onboarding — nombre del primer proyecto
    │   └── Dashboard.jsx             # /app — layout completo del museo (3 columnas)
    │
    ├── components/                   # Componentes reutilizables
    │   │
    │   ├── ── Auth / UI genérica ──
    │   ├── AuthLayout.jsx            # Layout 2 col para auth: panel de marca + panel form
    │   ├── FormField.jsx             # Field · Input · PasswordInput · PrimaryButton · GlobalError · Divider · Spinner
    │   ├── LoadingScreen.jsx         # Pantalla de carga con logo pulsante
    │   ├── Modal.jsx                 # Modal genérico (backdrop, Escape, animaciones)
    │   ├── Toast.jsx                 # Sistema de toasts global (ToastProvider + useToast)
    │   │
    │   ├── ── Dashboard ──
    │   ├── Sidebar.jsx               # Logo · navegación · ACTIVE PROJECT · user footer
    │   ├── TopBar.jsx                # Búsqueda · filtros All/Visuals/Drafts · "+ New Relic"
    │   ├── RelicCard.jsx             # Tarjeta de relic: thumbnail · categoría · título · descripción
    │   ├── RelicDetails.jsx          # Panel derecho: imagen pergamino · meta · Revive · Delete
    │   ├── RevivalZone.jsx           # Barra flotante drag-and-drop inferior
    │   ├── NewRelicModal.jsx         # Modal para crear un nuevo relic
    │   ├── Thumbnails.jsx            # Thumbnails CSS/SVG: Sketch · Copy · Palette · Branding · Notes · Parchment
    │   └── UserMenu.jsx              # Dropdown de usuario: Settings · Sign out (`MobileNav.jsx` reorganiza el sidebar en teléfonos)
    │
    ├── data/
    │   └── mockRelics.js             # Array de 5 relics demo (precargados para el usuario demo)
    │
    ├── lib/                          # Utilidades puras (sin UI)
    │   ├── hash.js                   # hashPassword · verifyPassword (mock, NO producción)
    │   ├── relicStorage.js           # CRUD de relics en localStorage por userId
    │   ├── storage.js                # Helpers genéricos: storageGet · storageSet · storageRemove
    │   └── validators.js             # Schemas Zod: login · register · forgot · onboarding · passwordStrength
    │
    └── hooks/                        # (Reservado para custom hooks futuros)
```

---

## Árbol de dependencias por capa

```
main.jsx
└── AppRouter.jsx
    ├── /login           → pages/Login.jsx
    │                       ├── components/AuthLayout.jsx
    │                       ├── components/FormField.jsx
    │                       ├── auth/AuthProvider.jsx  (useAuth)
    │                       ├── components/Toast.jsx   (useToast)
    │                       └── lib/validators.js
    │
    ├── /register        → pages/Register.jsx
    │                       └── (mismas dependencias que Login + react-hook-form useWatch)
    │
    ├── /forgot-password → pages/ForgotPassword.jsx
    │                       └── (AuthLayout · FormField · useAuth · validators)
    │
    ├── /onboarding      → pages/Onboarding.jsx
    │                       └── (AuthLayout · FormField · useAuth · MockAuthService directo)
    │
    └── /app             → pages/Dashboard.jsx
                            ├── components/Sidebar.jsx
                            │   └── components/UserMenu.jsx
                            │       └── auth/AuthProvider (useAuth, signOut)
                            ├── components/TopBar.jsx
                            ├── components/RelicCard.jsx
                            │   └── components/Thumbnails.jsx
                            ├── components/RelicDetails.jsx
                            │   └── components/Thumbnails.jsx (ParchmentImage)
                            ├── components/RevivalZone.jsx
                            ├── components/NewRelicModal.jsx
                            │   └── components/Modal.jsx
                            │   └── components/FormField.jsx
                            ├── lib/relicStorage.js
                            │   └── data/mockRelics.js
                            └── components/Toast.jsx (useToast)
```

---

## Proveedores globales (árbol de contextos)

```
<MotionConfig reducedMotion="user">  framer-motion — respeta reduced-motion del SO
  <ThemeProvider>                    useTheme() — tema claro/oscuro/automático
    <HashRouter>                     react-router-dom — hash routing (requerido por Tauri/file://)
      <AuthProvider>                 user · status · auth functions
        <ToastProvider>              push · dismiss
          <CloseGuard />             bloquea el cierre nativo si hay cambios sin guardar
          <AppRouter />              rutas
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  </ThemeProvider>
</MotionConfig>
```

Nota: se usa `HashRouter`, no `BrowserRouter` — la app se empaqueta como app de escritorio con Tauri y carga desde `file://`, donde las rutas basadas en history API no resuelven.

---

## Almacenamiento en el navegador

| Clave | Store | Contenido |
|---|---|---|
| `am_session` | localStorage / sessionStorage | Session JSON: `{ user, expiresAt, persistent }` |
| `am_users` | localStorage | Mapa `email → UserRecord` (con passwordHash) |
| `am_relics_{userId}` | localStorage | Array de Relic del usuario |
