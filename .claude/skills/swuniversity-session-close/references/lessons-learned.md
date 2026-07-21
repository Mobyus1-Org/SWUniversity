# Session Retro Log

Running log of process/development lessons surfaced at the end of each session via the
swuniversity-session-close retro question. Newest entries at the bottom. This is for
session-to-session process lessons — durable engine/feedback facts still go through the
memory system (see `MEMORY.md`), not just here.

## 2026-07-17

- **Repeated a documented lesson instead of applying it**: hit "wrong-fixture-HP" test failures
  multiple times this session (a unit I picked for a test died to damage I meant it to survive)
  even though "pull stats from generated.ts, never from memory" is an explicit rule in the
  implement-swu-card skill. The rule was followed for the *ability* stats but not consistently
  for filler/target units grabbed by familiar name. Fix for next time: grep the stat maps for
  EVERY unit placed in a fixture, not just the card under test, before writing assertions.
- **Invoked a same-named skill from a different project without checking its body first**
  (`swusim-session-close`, which pointed at an unrelated repo's memory file and PHP file). Now
  captured as [[feedback-skills-are-account-global]] in the memory system, and this repo has its
  own correctly-scoped session-start/close pair specifically to avoid recurring on this.
- **Misread an instruction's intended audience**: the user asked to add a retro *question*, and
  it was initially built to ask the *user* that question rather than having the agent answer it
  itself — required a correction round-trip. When a instruction is ambiguous about who answers a
  question ("we might use"), lean toward re-reading it in the context of what was just discussed
  (this was immediately after building a *self*-improving skill) before committing to an
  interpretation.
- **What worked well**: extending shared plumbing (a new roundState tracker, a new pending-type
  field) surfaced two genuine pre-existing latent bugs (puzzle-runtime.ts's incomplete hydration
  fallback, discard-from-hand's missing resolve-attack routing) that had nothing to do with the
  card being implemented. Actively tracing every consumer of shared state/pending types when
  extending them — not just the new call site — is worth keeping as standard practice, not just
  something that happened to pay off this time.

## 2026-07-20

- **Confirmed-repeat of the "account for what the engine does to the fixture" lesson** (a sibling
  of the logged "wrong-fixture-HP" one): a Deadly Vulnerability overwhelm test read `base=3` and I
  briefly suspected the engine before the game log revealed the real cause — a filler defender's
  "When Defeated: Draw a card" hit an EMPTY DECK, and the empty-deck penalty (3 base damage) masked
  the assertion. The engine was right; the fixture was wrong. New concrete rule to add to the
  mental checklist: **any fixture unit with a When-Defeated draw needs its owner given a deck card**
  unless the empty-deck penalty is the thing under test. Suspecting the fixture first (per the
  skill) and dumping the game log is what found it fast — that part worked.
- **Static traits: don't pass playId to `TraitContains` for a unit that may be out of play.** Blade
  of Talzin's When-Defeated crashed because I called `TraitContains(cardId, "Night", controller, playId)`
  on an already-removed unit, triggering a dynamic `GetUnitInPlay` lookup that hit undefined
  `captives`. For a printed/static trait, use the 2-arg `TraitContains(cardId, trait)` form. Cost one
  red test cycle.
- **New engine constraint discovered → memory'd:** deployed leaders can't have their Action
  re-invoked via `use-ability` (`handleUseAbility` rejects with "already deployed as a unit" for all
  leaders). Test the deployed side via `ActionAbilities(cardId, player, playId)` registration, not an
  end-to-end dispatch. Captured as [[engine-deployed-leader-action-uninvocable]].
- **What worked well (keep doing):** for large mixed batches (22 cards this time), a single upfront
  Explore-agent mapping pass — current state (done/partial/absent), exact edit file:line, and an
  analogue card ID per card — made implementation nearly mechanical and caught two already-done
  cards and two partial ones (wrong Raid amounts in the prior batch) before writing code. Also
  confirmed the prior "trace every consumer when extending shared plumbing" lesson: the double-damage
  upgrade needed hooks in BOTH combat-damage sites in resolveAttack AND the ability path in
  DealDamageToUnit — the mapping caught all three.
