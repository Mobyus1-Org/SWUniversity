# SHD Implementation Status

Shadows of the Galaxy. Ids are `SHD_NNN`; counts are cards whose id prefix is SHD, excluding
tokens and promo printings.

| Status | Count |
|--------|-------|
| Implemented | 218 |
| Remaining — keyword-only | 0 |
| Remaining — card work | 46 |
| **Remaining total** | **46** |

No leaders and no bases remain — every SHD leader is done on both sides.

## Phase 0 — Engine mechanics

Each blocks cards below it. Build these first; writing them inline inside the first card that
needs them is how they get written badly.

- [x] **Attack target in the phase ledger** — DONE — `roundState.unitsAttackedThisPhase` records
  `{fromPlayer, cardId, playId}` and NOT what was attacked, so "attacked your base this phase"
  cannot be answered. Adding a field means updating all three hand-written mirrors
  (`puzzle-runtime.ts`, `puzzle-builder-state.ts`, `StaticBoard.tsx`) plus a round-trip test —
  an optional field omitted from a mirror typechecks clean and vanishes in every puzzle.
  *Blocks SHD_106, SHD_088.*
- [x] **Sequential multi-attack** — DONE (proved with SHD_128 Outflank, now implemented) — "Attack with 2 units (one at a time)". No primitive chains N
  attacks. *Blocks SHD_128, SHD_145 — and lights up TWI_123 for free.*
- [x] **Action from the discard pile** — DONE (proved with SHD_038 Brutal Traditions, now implemented) — a card whose Action is used while it sits in the discard.
  A third actor location after unit/leader and the base-upgrade path built for HMW_037.
  *Blocks SHD_038, SHD_135; related to SHD_053.*
- [x] **Lose the game** — DONE — no path exists for a card to make its controller lose outright.
  *Blocks SHD_208 Final Showdown.*

Already present, checked — NOT Phase 0:
first strike (`ASH_202`, so SHD_234 is a one-line registration) · `namedCardTitle` on Unit
(`SOR_062`, so SHD_202 Qi'ra is ordinary work) · captives and rescue · card-played reactions.

## Phase 1 — Keyword-only + simple (20)

- [x] **Batch 1.1** — DONE — SHD_063 SHD_121 SHD_238 (keyword-only) · SHD_040 SHD_047 SHD_082 SHD_258
  SHD_083 SHD_234 SHD_262 SHD_108 SHD_244 SHD_183 SHD_199 SHD_196 SHD_209 SHD_260 SHD_245
  SHD_066 SHD_057

## Phase 2 — Ordinary card work (20)

- [ ] **Batch 2.1** — SHD_156 SHD_093 SHD_228 SHD_253 SHD_233 SHD_159 SHD_180 SHD_227 SHD_243 SHD_076
  SHD_206 SHD_207 SHD_101 SHD_254 SHD_189 SHD_246 SHD_241 SHD_255 SHD_239 SHD_163

## Phase 3 — Multi-clause / conditional (20)

- [ ] **Batch 3.1** — SHD_046 SHD_141 SHD_059 SHD_115 SHD_198 SHD_202 SHD_170 SHD_142 SHD_114
  SHD_088 SHD_106 SHD_144 SHD_182 SHD_194 SHD_205 SHD_232 SHD_077 SHD_036 SHD_053  *(SHD_038 done in Phase 0)*

## Phase 4 — Mechanic-dependent + remainder (6)

- [ ] **Batch 4.1** — SHD_157 SHD_145 SHD_135 SHD_208 SHD_109  *(SHD_128 done in Phase 0)*

Notes:
- **SHD_109 Endless Legions** ("Reveal any number of resources. Play each unit revealed this way
  for free") plays cards out of the RESOURCE zone — a host no other card uses. Treated as card
  work rather than Phase 0 because it is the only card that needs it, but it is the hardest single
  card in the set.
- **SHD_036 First Light** carries three separate abilities including a Smuggle cost; it is one
  card but roughly three cards of work.

## Phase 0 follow-up — a second prerequisite found

**SHD_135 Kylo's TIE Silencer** needs "if this unit was discarded from your hand or deck this
phase". There is no `cardsDiscardedThisPhase` ledger; the discard-hosted Action path it also needs
is now built, but this ledger is a separate prerequisite and must be done before SHD_135.
