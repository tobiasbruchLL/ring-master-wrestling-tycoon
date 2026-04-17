# Agent notes — Ring Master: Wrestling Tycoon

Single-page **wrestling promotion tycoon**: **Vite 6 + React 19 + TypeScript**. The shell is a **mobile-style portrait column** (`max-w-md`, `h-dvh`) with a **sticky header** (popularity bar, cash, settings), **bottom navigation** (hidden on planner/sim screens), and **motion** page transitions (`motion/react`). **Core state and persistence** live in `useGameState.ts`; **pure game math and rules** are split across `src/lib/*` and should stay test-friendly and side-effect free where possible.

## Quick facts

| Item | Detail |
| --- | --- |
| **Product name** | *Ring Master: Wrestling Tycoon* — `metadata.json`, `index.html` `<title>`, Capacitor `appName`, Android `strings.xml`; Settings shows *Ring Master v1.0.0*. |
| **Bundler / dev** | Vite 6 (`vite.config.ts`), `npm run dev` → port **3000**, `--host=0.0.0.0` |
| **Styling** | Tailwind CSS v4 via `@tailwindcss/vite`; tokens in `src/index.css` (`@theme`: accent, gold, card, border, bg, display font, etc.) |
| **Mobile wrapper** | Capacitor 8 (`capacitor.config.ts`): `appId` `com.nightskygames.ringmaster`, `webDir` `dist`, `appName` *Ring Master - Wrestling Tycoon* |
| **Tests** | No `test` script; `lint` is `tsc --noEmit` only |
| **Template deps** | `@google/genai`, `express`, and `dotenv` are in `package.json` but **not imported from `src/`** (AI Studio / hosting leftovers). Same for `GEMINI_API_KEY` / `APP_URL` in `.env.example`. |

## Repository layout

### Entry and shell

- **`src/main.tsx`** — React root mount.
- **`src/App.tsx`** — View router, header, bottom nav, dashboard **day actions** (plan show / run show / end day, including end-day-without-booked-show flow), toast host, modals. **Debug menu**: rapid-tap the **invisible strip** along the top of the shell (10 taps within ~2s); see `handleDebugTap` and the absolute `button` hit target.

### Views (`type View` in `App.tsx`)

`dashboard` | `roster` | `facilities` | `recruiting` | `planner` | `simulating` | `leagues`

### Features (`src/features/`)

| File | Role |
| --- | --- |
| `Dashboard.tsx` | Home / day context |
| `Roster.tsx` | Roster management, detail flows |
| `Recruiting.tsx` | Prospects, enlist / skip camp |
| `Facilities.tsx` | Facility upgrades + **roster capacity** upgrades |
| `Leagues.tsx` | League promotion |
| `ShowPlanner.tsx` | Book card + venue → `scheduleUpcomingShow` |
| `MatchSimulation.tsx` | Fight-night UI; uses `MatchOutcomeModal` |

### Components (`src/components/`)

| File | Role |
| --- | --- |
| `SettingsMenu.tsx` | Settings, reset, support link |
| `DebugMenu.tsx` | Debug cheats (money) |
| `ShowResultModal.tsx` | Post-show summary |
| `ToastStack.tsx` | `useToastStack` — transient messages / injury notices |
| `OnboardingDraftOverlay.tsx` | Opening draft until `hasCompletedOpeningDraft` |
| `RecruitTrainingModal.tsx` | Rookie camp training choices |
| `RecruitGraduationModal.tsx` | Face/heel pick for graduating recruits |
| `EndDayNoShowWarningModal.tsx` | Penalty warning when ending a day with no booked show |
| `WrestlerDetailModal.tsx` | Wrestler detail (used from roster flows) |
| `MatchOutcomeModal.tsx` | Per-match outcome (used from `MatchSimulation`) |

### State and types

- **`src/hooks/useGameState.ts`** — `GameState`, `localStorage` key **`ring_master_save`**, migrations/normalization for legacy saves, show pipeline (`simulateShow` / `commitSimulatedShow`), money, popularity, roster, facilities, leagues, recruiting, `endDay` / `endDayWithoutBookedShow`, draft completion, etc. Also exports pure helpers used by the shell: e.g. **`getPlannedShowRunBlockReason`**, **`isPlannedShowRunnableNow`**, **`applyWinnerHpOverridesToShowSimulation`**.
- **`src/types/index.ts`** — Domain model (`Fighter`, `Match`, `Show`, `GameState`, recruits, simulation DTOs, small predicates like `hasPendingRecruitTraining`).
- **`src/constants.ts`** — Starting economy, venues, names, traits, facility templates, marketing definitions, etc.

### `src/lib/` (prefer here for new pure rules)

| Module | Typical concern |
| --- | --- |
| `matchScoring.ts` | Match score breakdown, popularity from quality, winner HP rolls |
| `showEconomy.ts` | Ticket sales, setup / match costs |
| `showScheduling.ts` | Prep days between book and show night |
| `fighterShow.ts` | Energy costs, injury chances on booked fights |
| `promotionPopularity.ts` | Popularity tiers, deltas, expectation vs delivery |
| `facilityBonuses.ts` / `facilityCaps.ts` | Upgrade effects and per-league caps |
| `rosterCapacity.ts` | Max roster size, expansion pricing |
| `recruitTraining.ts` | Camp duration, training injury risk, stat helpers |
| `draftRoster.ts` | Opening draft picks / generation |
| `leagues.ts` | League tier progression |
| `utils.ts` | `cn` (clsx + tailwind-merge), `formatNumber`, shared pricing helpers |

Path alias: **`@/*` → repository root** (`.`); see `tsconfig.json` and `vite.config.ts`.

## Commands

```bash
npm install          # dependencies
npm run dev          # Vite dev server (port 3000)
npm run build        # production build → dist/
npm run preview      # preview production build
npm run lint         # TypeScript check (no emit)
npm run android:dev  # build + cap run android (needs Android toolchain)
```

On Windows, `npm run clean` uses `rm -rf` and may fail without a Unix-like shell; delete `dist/` manually if needed.

## Environment and secrets

- **`.env.example`** — `GEMINI_API_KEY`, `APP_URL` (Google AI Studio / hosting template).
- **`vite.config.ts`** — `loadEnv(mode, '.', '')` and `define` injects `process.env.GEMINI_API_KEY` into the client bundle. Nothing under `src/` reads it today.

## Agent / IDE ergonomics

- **`DISABLE_HMR=true`** — disables Vite HMR (`server.hmr: false` when set). Useful when external file watchers cause flicker.

## Conventions for changes

- **State vs logic**: keep **serializable** `GameState` shapes and migrations in **`useGameState`**; put **formula-heavy or reusable rules** in **`src/lib`** and call from the hook.
- **Persistence**: anything on `GameState` must remain **JSON-safe** for `localStorage`.
- **UI**: follow existing Tailwind patterns (`bg-bg`, `text-accent`, `font-display`, `cn()`). Respect **safe-area** utilities already used in the header and shell.
- **Capacitor**: after web changes for the packaged app, **`npm run build`** then your usual `npx cap sync` / `npm run android:dev` workflow.

## Files agents often touch

| Area | Files |
| --- | --- |
| Economy / show / match feel | `useGameState.ts`, `lib/showEconomy.ts`, `lib/matchScoring.ts`, `lib/showScheduling.ts`, `lib/fighterShow.ts` |
| Popularity / expectations | `lib/promotionPopularity.ts`, `constants.ts` |
| Facilities / roster cap | `lib/facilityBonuses.ts`, `lib/facilityCaps.ts`, `lib/rosterCapacity.ts`, `features/Facilities.tsx` |
| Recruits / draft | `lib/recruitTraining.ts`, `lib/draftRoster.ts`, `features/Recruiting.tsx`, recruit modals |
| New tab / screen | `src/features/*.tsx`, wire `View` + nav in `App.tsx` |
| Shared UI | `src/components/*.tsx` |
| Types | `src/types/index.ts` |

## Out of scope for most edits

- **`android/`** — generated/native artifacts; avoid drive-by commits unless the task is Android-specific.
- **`node_modules/`** — never edit; use `npm install`.
