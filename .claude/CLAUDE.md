# Overview
SWUniversity is a Next.js app that helps Star Wars: Unlimited players of all skill levels learn the game.

**Stack:** Next.js 16 (pages router) · React 18 · TypeScript · MongoDB/Mongoose · Tailwind · Vitest. Node 22.

## Modes
The webapp has many fun modes for players to engage with.

### Quiz
Multiple-choice questions from `public/quiz-database.json`. Sub-modes: standard (fixed length), iron-man (whole pool, ends on first miss), endless, and per-difficulty practice (padawan/knight/master). UI in `src/components/Quiz`, page container `src/containers/QuizPage.tsx`.

### Do You Know SWU (DYKSWU)
Card-image questions from `public/dykswu-database.json`. Each question has multiple `variants`, each with its own difficulty. Same sub-modes as Quiz. UI in `src/components/DoYouKnowSWU`. Based on the YouTube series by Mobyu1 (also the owner of this site).

### Puzzles
Board-state challenges backed by a full SWU rules engine (`src/lib/engine`, `src/server/engine`). Cards are generated into `src/server/engine/card-db`.

## Layout
- `pages/` — routes and API endpoints (`pages/api/**`).
- `src/components/` — UI. `src/containers/` — page-level composition.
- `src/util/` — shared client logic (stats derivation, data loaders, profile API client).
- `src/server/` — server-only: `auth/`, `models/` (Mongoose), `db.ts`, `engine/`, stats loaders.
- `public/*.json` — quiz/DYKSWU question data (read client-side via fetch, server-side via `fs`).
- `tests/unit/` — Vitest suites.
- `docs/superpowers/` — specs & plans (gitignored).

## Stats & profiles
User progress lives on the `UserProfile` Mongo doc (`gamesCompleted`, `endlessModeStats`, badges, mastered-question sets). Derived view models come from `src/util/profile-data.ts`; the profile page is `pages/profile.tsx`.

## Commands
- `npm run dev` — local dev server.
- `npm test` — unit tests (`vitest run tests/unit`; excludes the DB-backed integration test).
- `npm run build` — production build. `npm run lint` — eslint. `npx tsc --noEmit` — typecheck.

## Conventions
- Card/engine tests go in `tests/unit/<set>/`, named `<card-title>.test.ts` (sets: sor, shd, twi, jtl, lof, sec, …).
- In tests, reference cards via the `Cards` helper (e.g. `Cards.events.sor.strikeTrue`) — never raw ID strings.
- Extract shared mechanics into named generic helpers; per-card code should just call the helper.
- Follow existing patterns in the file you're editing; match its style and structure.

## Repo rules
1. You will never do git commit or push. I will commit manually.
2. Verify tests with `npm test` to exlcude the integration tests from a `vitest` run
