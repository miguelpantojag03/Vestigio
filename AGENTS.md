# AGENTS.md

This repository is a React + Vite app packaged as a native desktop app with Tauri (see `src-tauri/`) for Vestigio, a local-first archival dashboard for creative artifacts (“Relics”). Use the project docs as the source of truth for behavior and architecture.

Note: the app was rebranded from "Archivo Muerto" to "Vestigio" in the UI/docs only — the Tauri `identifier` (`com.archivomuerto.app`), the SQLite filename (`archivo_muerto.db`), and the repo/folder name stayed unchanged on purpose, since changing them would move or orphan the app's real on-disk data directory.

## High-level guidance

- Prefer small, idiomatic React components and keep UI logic close to the feature being edited.
- The app is deliberately local-first: authentication and relic data are stored in browser storage, not a backend.
- One deliberate, narrow exception: `backend/` is a stateless Cloudflare Worker that gates access to Cloudflare Workers AI (bound via `env.AI`, no external API key involved) behind a shared secret, so the public endpoint isn't open to casual abuse. It holds zero user data, has no database, and knows nothing about accounts. Don't treat its existence as license to add a general-purpose backend for anything else; that would still need the same explicit justification this one got.
- Keep route behavior aligned with the auth guards defined in [src/AppRouter.jsx](src/AppRouter.jsx) and the guard flow documented in [docs/NAVIGATION.md](docs/NAVIGATION.md).
- Follow the existing design tokens and styling conventions from [src/index.css](src/index.css) instead of introducing unrelated CSS systems.

## Key project docs

- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) — technical overview, setup, auth contract, validation, and production notes
- [docs/HIERARCHY.md](docs/HIERARCHY.md) — folder structure and dependency map
- [docs/NAVIGATION.md](docs/NAVIGATION.md) — user flows and route behavior
- [docs/ANDROID.md](docs/ANDROID.md) — building the APK, signing, and what differs from desktop

## Run and validate

```bash
npm install
npm run tauri dev     # native desktop window (the real app)
npm run tauri build   # packaged desktop binary
npm run dev           # frontend only, in a plain browser — no Tauri APIs
npm run build         # frontend build Tauri bundles into the binary
npx eslint src/       # project has no type checker; this is the correctness gate
npm run test          # Vitest — unit tests for lib/auth logic, colocated as *.test.js next to the module
./scripts/android-build.ps1  # APK for phones; see docs/ANDROID.md (needs ~6 GB free)
```

- `npm run dev` / `npm run build` build the frontend alone — useful for fast iteration, but anything behind a Tauri API (window close guard, single-instance lock) is a no-op outside the native shell.
- `npm run tauri dev` requires the Rust toolchain (`cargo`) to be installed and on `PATH`.

## Architecture and conventions

### Auth and routing

- App bootstrapping happens in [src/main.jsx](src/main.jsx), with `MotionConfig`, `ThemeProvider`, `HashRouter`, `AuthProvider`, and `ToastProvider` wrapped around `AppRouter`. It's `HashRouter`, not `BrowserRouter` — the app ships as a packaged Tauri desktop app loading from `file://`, where a `BrowserRouter`'s history-based routes don't resolve.
- Route protection is implemented in [src/auth/ProtectedRoute.jsx](src/auth/ProtectedRoute.jsx) and used in [src/AppRouter.jsx](src/AppRouter.jsx).
- Authentication is contract-driven via [src/auth/AuthService.js](src/auth/AuthService.js) and the mock implementation in [src/auth/MockAuthService.js](src/auth/MockAuthService.js).
- Production replacement should follow the same interface, but this project currently ships with a local-storage mock for demo use.

### Data persistence

- Relics are persisted via [src/lib/relicStorage.js](src/lib/relicStorage.js) and stored per user in browser storage.
- User records and active session are managed in the auth layer and `localStorage` / `sessionStorage` helpers.
- Demo data lives in [src/data/mockRelics.js](src/data/mockRelics.js); new users start empty unless seeded intentionally.

### Platforms

- The same code ships to desktop and Android. Layout differences go through `useIsMobile`/`useIsTouch` in [src/hooks/useViewport.js](src/hooks/useViewport.js); what Android itself can't do goes through `isAndroid` in [src/lib/platform.js](src/lib/platform.js).
- Desktop-only plugins are gated in `Cargo.toml`, `lib.rs` (`#[cfg(desktop)]`) and `capabilities/desktop.json`, all three together.
- Don't edit an applied migration: sqlx checksums them. sqlx opens connections with `foreign_keys=ON`, so a migration must never `DROP TABLE` a parent table, which would cascade to its children.

### UI organization

- Route-level pages live under [src/pages](src/pages).
- Reusable UI and shared primitives live under [src/components](src/components).
- Global CSS rules (resets, scrollbar, focus states) live in [src/index.css](src/index.css); actual color/radius/font *tokens* live in [src/styles/tokens.js](src/styles/tokens.js) — always read them via `useTheme()` from [src/context/ThemeContext.jsx](src/context/ThemeContext.jsx), never hardcode a hex or rgba literal that matches a token value, since it won't update when the user switches theme.
- The app is bilingual (es/en) via `react-i18next` — strings live in [src/i18n/locales](src/i18n/locales); don't hardcode user-facing copy in components, including error messages thrown from `lib`/`hooks`/`constants` modules.

## Working rules for contributors

- Do not add a real backend dependency unless the task explicitly requires it; the app is intentionally designed around browser-side storage.
- Preserve the demo-auth behavior and the mock data flow unless the task is explicitly about replacing it with a real auth provider.
- Prefer reusing styles and components already present in [src/components](src/components) over introducing new patterns.
- When changing nav or auth behavior, update the route logic and the docs in [docs/NAVIGATION.md](docs/NAVIGATION.md) together.
- Keep outputs consistent with the current app language and tone: modern, clean, and museum/archive themed.

## Suggested task checklist for agents

1. Read the relevant doc file first when the task touches routes, auth, or data model changes.
2. Identify whether the work belongs in pages, auth, lib, or components before editing.
3. Maintain compatibility with current protected/guest route semantics.
4. Run `npm run build` after a meaningful feature or refactor change.

## Useful links

- [src/AppRouter.jsx](src/AppRouter.jsx)
- [src/auth/AuthProvider.jsx](src/auth/AuthProvider.jsx)
- [src/auth/MockAuthService.js](src/auth/MockAuthService.js)
- [src/lib/validators.js](src/lib/validators.js)
- [src/components/Toast.jsx](src/components/Toast.jsx)
- [src/styles/tokens.js](src/styles/tokens.js) — color/radius/font tokens, both themes
- [src/context/ThemeContext.jsx](src/context/ThemeContext.jsx) — `useTheme()`
- [src/i18n/index.js](src/i18n/index.js) — i18next setup, `setLanguage()`
- [src/lib/windowCloseGuard.js](src/lib/windowCloseGuard.js) — unsaved-changes guard for the native window close
