# Agent notes — Ring Master / Iron Grip Manager

This repository is a **single-page wrestling promotion tycoon** built with **Vite + React 19 + TypeScript**. The UI is a **mobile-style portrait shell** (`max-w-md`) with bottom navigation. Game logic and persistence live primarily in one hook plus feature screens.

## Quick facts


| Item               | Detail                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Product name**   | *Ring Master: Wrestling Tycoon* (`metadata.json`); in-app branding: *Iron Grip Manager*                              |
| **Bundler / dev**  | Vite 6 (`vite.config.ts`), dev server port **3000**, `--host=0.0.0.0`                                                |
| **Styling**        | Tailwind CSS v4 via `@tailwindcss/vite`; design tokens in `src/index.css` (`@theme`: accent, gold, card, border, bg) |
| **Mobile wrapper** | Capacitor 8 (`capacitor.config.ts`): `appId` `com.nightskygames.ringmaster`, `webDir` `dist`                         |
| **Tests**          | No `test` script in `package.json`; `lint` runs `tsc --noEmit` only                                                  |


## Repository layout

- `**src/App.tsx`** — View router (`dashboard` | `roster` | `facilities` | `planner` | `simulating`), header, bottom nav, modals (settings, debug, show result). Debug menu: rapid-tap title (10 taps within ~2s).
- `**src/hooks/useGameState.ts`** — Core state: money, popularity, roster, facilities, show history, `runShow`, hiring/firing, upgrades, `localStorage` key `**ring_master_save`**.
- `**src/features/`** — `Dashboard`, `Roster`, `Facilities`, `ShowPlanner`, `MatchSimulation` (feature-sized screens).
- `**src/components/**` — `SettingsMenu`, `DebugMenu`, `ShowResultModal`.
- `**src/types/index.ts**` — Domain types (`Fighter`, `Match`, `Show`, `GameState`, etc.).
- `**src/constants.ts**` — Starting data, venues, names, traits, facilities.
- `**src/lib/utils.ts**` — `cn` (class merging), `formatNumber`, shared helpers.

Path alias: `**@/*` → repo root** (see `tsconfig.json` and `vite.config.ts`).

## Commands

```bash
npm install          # dependencies
npm run dev          # Vite dev server (port 3000)
npm run build        # production build → dist/
npm run preview      # preview production build
npm run lint         # TypeScript check (no emit)
npm run android:dev  # build + cap run android (needs Android toolchain)
```

On Windows, `npm run clean` uses `rm -rf` and may fail unless a Unix-like shell is available; prefer deleting `dist/` manually if needed.

## Environment and secrets

- `**.env.example**` documents `GEMINI_API_KEY` and `APP_URL` (Google AI Studio / hosting template context).
- `**vite.config.ts**` exposes `process.env.GEMINI_API_KEY` to the client bundle via `define` (loaded from env prefix `.` in `loadEnv`).
- As of this tree, **application source under `src/` does not import `@google/genai`**; the dependency and env wiring are likely **template leftovers** for future AI features. Do not assume Gemini is required to run the game locally.

## Agent / IDE ergonomics

- `**DISABLE_HMR=true`** — Vite `server.hmr` is turned off when set (comment in `vite.config.ts`: reduces flicker when external tools watch files). Useful for automated or agent-driven editing sessions.

## Conventions for changes

- Prefer **extending `useGameState`** for new economy/roster/show rules; keep `**GameState**` and `**src/types**` in sync.
- **Persistence**: anything added to `GameState` should remain **JSON-serializable** (localStorage).
- **UI**: match existing Tailwind patterns (`bg-bg`, `text-accent`, `font-display`, `cn()` for conditional classes). `motion` is imported from `**motion/react`** (see `App.tsx`).
- **Capacitor**: after web changes that affect the packaged app, run `**npm run build`** then sync/run Android as your workflow requires (`npx cap sync` if you add native config).

## Files agents often touch


| Area                 | Files                                   |
| -------------------- | --------------------------------------- |
| Game rules / balance | `useGameState.ts`, `constants.ts`       |
| New screen           | `src/features/*.tsx`, wire in `App.tsx` |
| Shared UI            | `src/components/*.tsx`                  |
| Types                | `src/types/index.ts`                    |


## Out of scope for most edits

- `**android/`** build artifacts — avoid committing unless the task is explicitly Android-related; prefer `npx cap` workflows from docs when changing native projects.
- `**node_modules/`** — never edit; regenerate via `npm install`.

