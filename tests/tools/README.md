# tests/tools — agent tooling

**This directory is for AI agents working on this repo.** It holds small, standalone scripts for
development and debugging. Nothing here is a test, nothing here ships, and nothing in `src/` may
import from it.

If you are an agent and you find yourself writing a throwaway script to answer a question about
this codebase — check here first, and if you write a genuinely reusable one, add it here rather
than deleting it.

## Why these are excluded from the test run

| Gate | Why these files are skipped |
|---|---|
| `npm test` (`vitest run tests/unit`) | different directory |
| `npm run test:run` (`vitest run`) | `vitest.config.ts` excludes `tests/tools/**` |
| `npx tsc --noEmit` | `tsconfig.json` only includes `**/*.ts` / `**/*.tsx` |
| `npm run lint` | `eslint.config.mjs` only lints `**/*.{ts,tsx}` |

Keep tools as **`.mjs`** (the same convention as `scripts/`). That is what keeps them out of all
four gates. A `.ts` file here would be typechecked, and a `*.test.ts` file would need the vitest
exclude to save it — don't rely on that.

Run everything **from the repo root**, so `node_modules` resolves:

```bash
node tests/tools/card-info.mjs SEC_232
```

## Rules

1. **Read-only against anything live.** `puzzle-fetch.mjs` talks to the production database. It
   issues only `find`/`findOne`. Do not add a write path to a tool — if a puzzle needs changing,
   that is a job for the puzzle editor UI, with the user driving.
2. **Never print secrets.** Tools may *read* `.env` to get a connection string; they must never
   echo it, log it, or write it into a file. If you add a tool that reads config, follow
   `connectionString()` in `puzzle-fetch.mjs`.
3. **Ask before touching production data.** Reading the live database is reasonable when a bug
   only reproduces against stored state, but check with the user first — it is their production
   data, and the fact that a read is safe is not obvious from the outside.
4. **Dumps go to the scratchpad, not the repo.** Use `--out /tmp/...` (or the session scratchpad).
   Never commit a fetched document.

## Tools

### `card-info.mjs` — query the generated card database

`src/server/engine/card-db/generated.ts` is far too large to read into context, and its properties
live in ~19 *parallel* dictionaries (`cardCost`, `cardPower`, `cardHp`, … are separate maps), so
grepping it by hand invites reading a stat off the wrong map. This joins them per card.

```bash
node tests/tools/card-info.mjs SEC_232              # full detail for one id
node tests/tools/card-info.mjs kreia                # search by title/subtitle
node tests/tools/card-info.mjs --grep "Name a card" # search card text
node tests/tools/card-info.mjs --help               # all filters
```

**Finding a clean test fixture** is the other main use. Most wasted debugging in this repo comes
from fixture cards with abilities you forgot about — a unit whose power is conditional, or one
whose When Defeated draws from an empty deck. `--no-text` finds cards with no card text at all:

```bash
# a plain Republic ground unit with nothing printed on it
node tests/tools/card-info.mjs --set TWI --type Unit --trait Republic --arena Ground --no-text
```

It also prints `cardLeaderUnitText` for leaders, which is a separate field from `cardText` and is
easy to miss — a leader is not implemented until both sides are.

### `puzzle-fetch.mjs` — read a puzzle from the database

Puzzles live in MongoDB, not in the repo, so a puzzle-specific bug cannot be reproduced from any
local fixture. Read the rules above before using this.

```bash
node tests/tools/puzzle-fetch.mjs --list
node tests/tools/puzzle-fetch.mjs "colors of leadership"
node tests/tools/puzzle-fetch.mjs "colors of leadership" --out /tmp/colors.json
node tests/tools/puzzle-fetch.mjs --audit roundState   # how many puzzles omit a field
```

The summary calls out **`roundState stored: NO`**, which matters more than it looks: no stored
puzzle carries a `roundState`, so every puzzle runs on the fallback defaults in
`src/server/puzzle/adapters/puzzle-runtime.ts`. A field missing from those defaults is missing in
every puzzle at once — that is exactly how every draw effect in every puzzle came to throw
"Unable to process dispatch."

### `import-swusim-mocks.mjs` — convert SWUSim card mocks into this repo

The sibling SWUSim project keeps its preview definitions in `AppCore/SWU/CardMocks.php` (a PHP
`var_export` array). This converts entries into `card-mocks.json`'s schema.

```bash
S=~/Documents/GitHub/Karabast-SWU/OTMTCGE/AppCore/SWU/CardMocks.php
node tests/tools/import-swusim-mocks.mjs $S --set HMW --list       # what is available
node tests/tools/import-swusim-mocks.mjs $S HMW_T02 HMW_T03        # print the conversion
node tests/tools/import-swusim-mocks.mjs $S --set HMW --only-new --write
```

**It prints by default and writes only with `--write`** — a mock is checked-in data that drives the
generated card database, so it deserves a read first. That caught a real bug on the first run: an
empty `aspect => array()` let a lazy regex swallow the NEXT key's items, filing every trait as an
aspect.

**Use `--only-new` for a bulk import.** Our entries have been corrected against the printed cards;
the SWUSim copies of the same ids carry "Kashirho" for Kachirho, "Captivaling" for Captivating, a
mangled Fortify reminder, and an IC27 image URL on an HMW card. A blanket overwrite imports those
regressions on top of data the implementations and tests were built against.

After writing, the user must run **Fetch SWU Cards + Images** in `/internal/zzCardCodeGenerator` —
nothing reaches the engine until `generated.ts` is regenerated.

### `card-db.mjs`

Shared parser for `generated.ts`. Not a CLI — import `loadCards()` / `findById()` / `formatCard()`
from it when writing a new tool.

## Reproducing a puzzle bug

The workflow that found the `cardsDrawnThisPhase` crash, in case you need it again:

1. `node tests/tools/puzzle-fetch.mjs "<puzzle name>" --out /tmp/p.json`
2. Write a **temporary** `tests/unit/__repro.test.ts` that hydrates it and dispatches the failing
   action inside a `try/catch`, logging the caught stack:

   ```ts
   const doc = JSON.parse(fs.readFileSync("/tmp/p.json", "utf8"));
   const g = new GameTestAdapter();
   g.loadNewState(hydratePuzzleGame(doc.initialGamestate));
   try { await g.playCardFromHandAsync(1, idx); }
   catch (e) { console.log((e as Error).stack); }
   ```

3. Run it with `--reporter=verbose` — plain `vitest run` swallows `console.log`.
4. **Delete the repro file** once you have the stack trace, and encode the real fix as a proper
   regression test under `tests/unit/`.

The API returns a generic `"Unable to process dispatch."` for *any* thrown exception, so that
message alone tells you nothing. The stack from step 3 is the actual information.
