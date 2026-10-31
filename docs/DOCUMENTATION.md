# Vestigio — Documentación técnica

> Versión: 0.0.0 · Stack: React 19 + Vite 8 + Tauri 2 · Fecha: Oct 2026

---

## Descripción general

**Vestigio** es una app de escritorio (Windows/macOS, empaquetada con Tauri) para equipos creativos que permite guardar, organizar y revivir ideas descartadas (borradores, paletas, bocetos, copies, notas) como *Relics* (reliquias). Funciona como un museo de ideas: lo que se descarta no se pierde, se archiva y puede volver a un proyecto activo en cualquier momento. No depende de ningún servidor remoto — todo corre localmente dentro del WebView.

---

## Stack tecnológico

| Capa | Librería / Herramienta | Versión |
|---|---|---|
| Shell nativo | Tauri (Rust) | ^2.12.1 |
| UI framework | React | ^19.3.0 |
| Build tool | Vite | ^8.3.0 |
| Estilos | Tailwind CSS (reset/utilidades base) + tokens propios en JS | ^4.3.3 |
| Animación | Framer Motion (drag, modales, toasts, reduced-motion) | ^14.0.0 |
| Routing | React Router DOM (`HashRouter`, requerido por `file://`) | ^7.18.4 |
| i18n | react-i18next / i18next (es/en) | — |
| Formularios | React Hook Form | ^7.88.0 |
| Validación | Zod | ^4.6.5 |
| Adjuntos | idb (IndexedDB) | ^8.0.3 |
| Iconos | Lucide React | ^1.47.0 |
| Tipografía | Inter · Newsreader · JetBrains Mono (self-hosted, sin Google Fonts) | — |

> Los estilos visuales (color, radio, tipografía) **no** viven en Tailwind ni en CSS plano — ver [Design Tokens](#design-tokens) más abajo.

---

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. App de escritorio real (requiere el toolchain de Rust / cargo)
npm run tauri dev

# 3. Build del binario empaquetado
npm run tauri build

# — Solo frontend, en un navegador normal (sin APIs de Tauri) —
npm run dev       # modo desarrollo, http://localhost:5173
npm run build     # build que Tauri empaqueta en el binario
npm run preview   # preview del build
```

> Cualquier cosa detrás de una API de Tauri (el guardián de cierre de ventana, el bloqueo de instancia única) no hace nada fuera del shell nativo — probá siempre con `npm run tauri dev` para validar ese tipo de cambios.

### Credenciales demo precargadas

```
Email:    julian@archivomuerto.com
Password: Demo1234!
```

> En la pantalla de login hay un botón **"Use demo account"** que rellena las credenciales automáticamente.

---

## Design Tokens

Definidos en `src/styles/tokens.js`, no en CSS. Siempre se leen vía el hook `useTheme()` (`src/context/ThemeContext.jsx`) — nunca como literal hardcodeado, porque los literales no reaccionan al cambio de tema (bug real encontrado y corregido en la auditoría de oct. 2026).

Identidad visual actual: **"luz de luna sobre niebla"** — azul / lavanda / salvia / terracota, con variante clara ("ink", oscurecida para contraste AA) y oscura por cada color. `palettes = { dark, light }` en `tokens.js`; `color.*` siempre resuelve al tema activo.

| Token | Dark | Light (`*Ink`) | Uso |
|---|---|---|---|
| `blue500` | `#5D85A8` | `#3D6B88` | Acento primario — selección, foco, enlaces |
| `lavender500` | `#9893A8` | `#5F5A74` | Secundario — archivado |
| `sage500` | `#7FB38A` | `#357048` | Éxito, estado "activo" |
| `terracotta500` | `#C97B6E` | `#9A4A3C` | Error, peligro, eliminar |
| `bgBase` | `#0E1114` | `#F2EFE8` | Fondo general |
| `bgElevated` | `#1B232B` | `#FFFFFF` | Tarjetas, modales |
| `bgBorder` | `#26323C` | `#DEDAD0` | Bordes de inputs y tarjetas |
| `textPrimary` | `#ECEEF0` | `#1C1B18` | Títulos y texto principal |
| `textSecondary` | `#949CA6` | `#6B675E` | Metadatos, descripciones |

Washes translúcidos (fondos de chips, resplandores de foco) se generan con `alpha(hex, alpha)` desde `tokens.js`, nunca como string `rgba(...)` literal.

**Tipografía:** `font.ui` = Inter · `font.display` = Newsreader (itálica para títulos de relics) · `font.mono` = JetBrains Mono (metadatos). Self-hosted vía `@font-face` en `src/index.css`, sin Google Fonts.

**Radios:** `chipSm` `4px` · `chip` `6px` · `controlXs` `8px` · `controlSm` `9px` · `control` `10px` · `card` `16px` · `glass` `24px` · `pill` `999px`.

**Tema:** claro / oscuro / automático (sigue `prefers-color-scheme` en vivo), persistido en `localStorage` vía `ThemeContext`. **Idioma:** español / inglés vía `react-i18next`, persistido igual. Ambas preferencias se aplican antes del primer render visible.

---

## Capa de autenticación

### Interfaz `AuthService` (`src/auth/AuthService.js`)

Define el contrato que toda implementación debe cumplir:

```js
signIn(email, password, remember)   → Promise<Session>
signUp(email, password, fullName)   → Promise<User>
signOut()                           → Promise<void>
getSession()                        → Promise<Session | null>
resetPassword(email)                → Promise<void>
setActiveProject(userId, name)      → Promise<void>
onAuthStateChange(callback)         → () => void   // retorna unsuscribe
```

### `MockAuthService` (`src/auth/MockAuthService.js`)

Implementación mock basada en `localStorage`. Simula latencia de ~600 ms.

- Contraseñas hasheadas con `btoa` + salt (`src/lib/hash.js`). **No usar en producción.**
- Sesiones persistidas como JSON en `localStorage` (remember me) o `sessionStorage`.
- Expiración: 7 días desde el sign in.
- Usuario demo precargado automáticamente en el primer arranque.

> ⚠️ Para conectar Supabase o Firebase, crear una nueva clase que implemente el mismo contrato y reemplazar la línea `const authService = MockAuthService` en `AuthProvider.jsx`.

### `AuthProvider` (`src/auth/AuthProvider.jsx`)

Contexto React que expone:

```js
{ user, status, signIn, signUp, signOut, resetPassword, setActiveProject }
```

`status`: `"loading"` | `"authenticated"` | `"unauthenticated"`

### `ProtectedRoute` / `GuestRoute` (`src/auth/ProtectedRoute.jsx`)

- `<ProtectedRoute>` — redirige a `/login` si no hay sesión, preservando la ruta de destino en `location.state.from`.
- `<GuestRoute>` — redirige a `/app` si ya hay sesión activa.

---

## Módulo de Relics

### Tipos de categoría

| Categoría | Filtro | Thumbnail |
|---|---|---|
| SKETCH | visuals | Fondo gris con líneas y puntos SVG |
| COPYWRITING | drafts | Fondo oscuro con líneas de texto |
| PALETTE | visuals | 3 franjas de color verticales |
| BRANDING | visuals | Fondo oscuro con glifo SVG |
| NOTES | drafts | Fondo oscuro con comilla tipográfica |

### `relicStorage.js` (`src/lib/relicStorage.js`)

CRUD sobre `localStorage` con clave `am_relics_{userId}`.

```js
getRelics(userId)              → Relic[]
saveRelics(userId, relics)     → void
addRelic(userId, relic)        → Relic[]
updateRelic(userId, id, patch) → Relic[]
deleteRelic(userId, id)        → Relic[]
```

Al primer acceso del usuario demo, se precargan los 5 relics de la captura (`src/data/mockRelics.js`). Un usuario nuevo empieza con array vacío.

---

## Validación de formularios

Definida en `src/lib/validators.js` con Zod. Los schemas son **funciones factory**, no exports estáticos, porque los mensajes de error deben venir de `t()` (i18next) según el idioma activo:

| Factory | Campos | Reglas especiales |
|---|---|---|
| `getLoginSchema(t)` | email, password, remember | — |
| `getRegisterSchema(t)` | fullName, email, password, confirmPassword | Password: mín 8 chars, 1 mayúscula, 1 número, 1 especial · passwords iguales |
| `getForgotSchema(t)` | email | — |
| `getOnboardingSchema(t)` | projectName | Máx 40 chars |

Uso típico: `const schema = useMemo(() => getLoginSchema(t), [t])` dentro del componente, para que el schema se regenere si el usuario cambia de idioma con el formulario abierto.

`passwordStrength(password)` devuelve un score de 0–4 usado por el medidor visual (no depende del idioma).

---

## Componentes reutilizables

### `FormField.jsx`
- `<Field>` — wrapper con label + mensaje de error accesible (`role="alert"`, `aria-live`)
- `<Input>` — input con estilos de error y focus ring violeta
- `<PasswordInput>` — igual que Input + toggle mostrar/ocultar
- `<PrimaryButton>` — botón submit con estado de carga (spinner)
- `<GlobalError>` — franja de error global del formulario
- `<Divider>` — separador con texto centrado
- `<Spinner>` — SVG animado

### `Toast.jsx`
Sistema de notificaciones global via contexto. Uso:
```js
const { push } = useToast()
push('Mensaje', 'success' | 'error' | 'info', durationMs)
```

### `Modal.jsx`
Modal genérico con backdrop, cierre por Escape y por click fuera. Animaciones de entrada con CSS keyframes.

---

## Accesibilidad

- Todos los campos tienen `<label>` asociado.
- Errores con `aria-invalid` y `aria-live="polite"`.
- Errores globales con `aria-live="assertive"`.
- Navegación por teclado: formularios completos (Enter envía), y desde la auditoría de oct. 2026 también las tarjetas de relic (`tabIndex`, `role="button"`, `Enter`/`Espacio` para seleccionar — antes solo funcionaban con mouse).
- Focus visible con el anillo de `color.blue500` del tema activo en todos los elementos interactivos (ya no es un violeta fijo).
- `MotionConfig reducedMotion="user"` en la raíz (`main.jsx`) — las animaciones de Framer Motion (drag, modales, toasts, cambio de tema) respetan `prefers-reduced-motion` del sistema operativo.
- Botones deshabilitados durante peticiones en curso.

---

## Notas de producción

1. Reemplazar `MockAuthService` por una implementación real (Supabase/Firebase) — o, dado que la app es de escritorio, evaluar si directamente conviene una base de datos local real (SQLite) en vez de localStorage/IndexedDB; ver nota de arquitectura más abajo.
2. Nunca almacenar credenciales en el cliente — el hash simulado en `lib/hash.js` **no es seguro**.
3. `Content-Security-Policy`: `src-tauri/tauri.conf.json` la tiene en `null` (desactivada) — revisar antes de distribuir ampliamente.
4. `handleDelete` en `Dashboard.jsx` ya usa un modal de confirmación propio (`useConfirm()` / `ConfirmModal.jsx`), no `window.confirm` — esta nota ya no aplica, se deja documentada por si el patrón se repite en código nuevo.

### Gap de arquitectura conocido (sin resolver, ver auditoría de oct. 2026)

No existe una base de datos real: todo vive en `localStorage` (usuarios, sesión, relics) e IndexedDB (adjuntos) dentro del propio WebView. El plan original contemplaba una capa SQLite que nunca se construyó. Tampoco existen `status_history` ni un contador de revivals por relic, y el modelo de datos es binario (`archived` / `revived`), no el ciclo de 3 estados (activa → archivada → revivida) que se había planteado. Ninguno de estos es un bug puntual — son funcionalidades del concepto original que quedaron pendientes.
