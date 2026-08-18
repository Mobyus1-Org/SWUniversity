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

## 2026-07-25

- **Claimed an audit complete when the regex only caught one form of the pattern.** The
  large-res scaling work converted hardcoded px→rem using `grep -rnoE "\[[0-9]+px\]"`, which
  only matches px that is the *entire* Tailwind arbitrary value. It MISSED px embedded in
  compound expressions — `grid-cols-[minmax(0,1fr)_165px_minmax(0,1fr)]`, `w-[min(90vw,700px)]`
  — so I reported the scaling done and the user then hit "squished leader/base cards at 4K"
  (the 165px arena track never scaled). Lesson: a grep-based "found all N occurrences" claim is
  only as good as the regex's coverage of variant forms. Before claiming a pattern sweep
  complete, enumerate the forms the pattern can take (standalone, embedded in minmax/min/calc/
  gradient, inline style) and sweep the broad form (`[0-9]+px`), then classify. Memory'd as
  [[ui-px-audit-compound-values]]. This is a sibling of the standing "trace every consumer when
  extending shared plumbing" lesson — same failure shape (partial coverage), different domain.
- **Fixed symptoms before finding a data root cause; needed a user nudge to check the data file.**
  For the DYKSWU crashes I added client guards first (good defense) but my initial root-cause
  theory was "empty difficulty sets." The user asked "were you able to find the root cause from
  the database?" — and the actual cause was duplicate `id`s (70, 91) in `dykswu-database.json`,
  which the whole id-keyed flow can't tolerate. Lesson: for data-driven crashes (undefined from a
  `.find`/index into config/JSON), inspect the data file for integrity (dup keys, empty fields)
  EARLY, in parallel with reading code paths — don't wait to be pointed at it. Memory'd as
  [[data-dykswu-id-keyed-flow]].
- **Designed an access-gated feature without stating the real security boundary; user caught it.**
  My first "Show Solution" design was a client-only disabled-button gate. The user asked whether a
  savvy user could just remove the `disabled` prop — which exposed that the solution was ALREADY
  shipped to every client in the `/api/puzzles` payload, making the whole gate cosmetic. Lesson:
  when a feature is "only X users may see Y," proactively trace where Y is actually delivered and
  state the enforceable boundary (and what stays soft) IN the design phase, rather than presenting
  a client-only gate and waiting for the user to notice. Led to a server-side strip. Policy
  memory'd as [[project-puzzle-solution-gate]].
- **What worked well (keep doing):** (1) The brainstorm→spec→plan→inline-execute flow with an
  approval gate at each transition was smooth across three features and let scope changes (the
  server-hardening pivot) fold in cleanly by editing spec+plan before touching code. (2) Adapting
  the plan template honestly to this repo instead of following it blindly — no commit steps
  (rule 1), and explicitly writing "verification is tsc/build + manual UI checks, npm test can't
  see this" and "lint baseline is 40 problems, clean = no NEW problems" rather than inventing fake
  TDD cycles or asserting a false clean-lint. (3) Catching my own clamp arithmetic slip
  (0.521vw put 1920px 0.003px above the floor, breaking the no-op-at-1920 guarantee) during
  execution and rounding down to 0.5208vw, keeping spec/plan/code in sync.

## 2026-08-09

- **Third repeat of the fixture lesson** (logged 2026-07-17 and again 2026-07-20 — it keeps
  happening in new disguises). This session it cost ~5 red cycles across five *different* fixture
  mistakes, none of them the already-logged "wrong HP" form: (a) `CardCost` ≠ `playCost` — Battlefield
  Marine is Command/Heroism and carried a +2 aspect penalty against the test's base/leader, so
  Dooku's Palace expectations were all off; (b) reaching the regroup phase needs the passes in
  turn order (P2 then P1) or the dispatch is silently rejected and the test reads as a no-op;
  (c) `MyLeader(x, true, true)` means ALREADY deployed, so `deployLeaderAsync` is rejected —
  When-Deployed tests must start undeployed; (d) `FillResourcesForPlayer` pushes into the OWNER's
  array, so it cannot express "P1 controls a resource P2 owns"; (e) two identical units in a
  fixture made an assertion ambiguous. The standing rule ("pull stats from generated.ts") is too
  narrow — the real rule is **verify every fixture assumption against the builder/engine, not just
  card stats**: cost via `playCost`, turn order, builder param semantics, and unit uniqueness.
- **Anchored an edit onto the wrong function.** Inserted a `case "SEC_232"` by anchoring on
  `case "SHD_197"`, which exists in BOTH `resolveChooseOne` and `applyAbilityOptionEffect`. It
  landed in the latter; the prompt rendered but never resolved, costing a debug cycle. This file
  has several switch statements over `pending.cardId` — **confirm the enclosing function of an
  anchor before inserting**, especially in dispatch-listener.ts.
- **The shell here is zsh with ugrep, not bash with GNU grep.** Unquoted `$files` does NOT
  word-split (perl received one giant filename and silently did nothing — twice), and `grep -Z`
  means *fuzzy match* in ugrep, not NUL-separated. Use `while IFS= read -r` loops for file lists.
- **Confirmed working — [[feedback-skills-are-account-global]] (logged 2026-07-17) fired exactly as
  intended.** `/swusim-session-close` was invoked here; checking the skill body first showed it
  targets a *different* repo's 245KB memory file and a `GameLayout.php` this repo doesn't have.
  Stopped before writing. The lesson-to-memory-to-averted-incident loop worked end to end.
- **When the user enumerates scenarios, encode ALL of them as tests before judging which pass.**
  Asked "do we have tests for these 5 cases?", I wrote all five plus the named draw source rather
  than reasoning from the code — which surfaced two real gaps my own tests had missed (a piloting
  leader making its HOST the leader unit, and deck-search draws bypassing `DrawCardForPlayer`
  entirely). Reading the code would have confirmed my own assumptions.
- **Mutation testing is the right recovery when tests pass on the first run.** Twice I wrote tests
  then implemented without observing red (Curious Flock's Credit cases, all of Flipatine). Rather
  than assert they were meaningful, I mutated the implementation — counting the declared amount
  instead of resources exhausted; removing the flips; forcing both `if` conditions true — and
  confirmed exactly the intended tests failed. Keep this as the standard fallback, but prefer
  actually running red first.

## 2026-08-18

- **Confirmed working — the "prefer actually running red first" lesson (logged 2026-08-09, where
  Flipatine's tests had to be validated by mutation instead).** Same card, opposite outcome: this
  session's four aspect-penalty tests and four builder tests were written before any implementation
  and produced genuine red (3 failures, then 3 more), so no mutation pass was needed to prove they
  were meaningful. The prior entry named Flipatine explicitly, and re-reading it before starting is
  what made the ordering deliberate rather than lucky.
- **Repeat, new disguise — the zsh shell lesson (logged 2026-08-09 as "zsh with ugrep, not bash").**
  Opened the session with two `grep -rn "..." --include=*.ts` calls that both died with
  `zsh: no matches found: --include=*.ts` — zsh glob-expands unquoted flag values, unlike bash.
  Cost a round trip. Concrete rule: **quote any flag value containing `*` or `?`**
  (`--include="*.ts"`), the same way the earlier lesson requires quoting/looping for file lists.
- **A "UI-only" feature request had an invisible engine half.** "Need a way to start him on his
  Villainy side" reads as a builder checkbox, but `hydrateLeader` in puzzle-runtime.ts never copied
  `Leader.flipped`, so even hand-editing the stored JSON would not have worked. Because the field is
  OPTIONAL, the omission typechecks clean and every `GameStateBuilder`-based test still passes — the
  gap is invisible to the entire unit suite. This is the second distinct instance in that same file
  (the roundState fallback was the first, 2026-07-17). Generalised rule now memory'd as
  [[engine-puzzle-runtime-hydrator-mirror]]: **when adding a field to a state interface, add it to
  puzzle-runtime.ts's hydrator and the builder's toRaw/parseRawPlayer, and cover it with a
  round-trip test** — three hand-written mirrors, none compiler-enforced.
- **The user's stated hypothesis was the root cause, and checking it against the data file took two
  minutes.** "I think the bug might come from the FFG api data returning one array with all the
  aspects" — one grep of `generated.ts` confirmed `TWI_017: "Cunning,Villainy,Heroism"` before any
  code was read. Sibling confirmation of the 2026-07-25 lesson ("for data-driven bugs, inspect the
  data file EARLY"). Worth stating as a default: **when a bug report comes with a hypothesis about
  data, verify it against the data file as step one** — it is cheap, and it either scopes the fix
  immediately or rules out a whole branch.
- **Stale tracker caught only at session close, not during work.** `leaders-implement.md` still
  listed TWI_017 as "Missing: front + deployed · Existing refs: none" even though the leader had
  shipped in a prior session and this one only fixed its bugs. Updated here (moved to Complete,
  counts 88→89 / 66→65). The standing [[feedback-tracker-update]] rule fires on *implementation*
  sessions; it does not cover *bug-fix* sessions on an already-shipped card, which is exactly when
  the tracker's staleness goes unnoticed. Cheap addition to the mental checklist: when touching a
  card, grep the trackers for its id regardless of whether the work is new implementation.
