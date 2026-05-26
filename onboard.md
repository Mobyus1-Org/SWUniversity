# Card Implementation Onboarding

This guide is for developers adding implementations for new cards. You will not touch core mechanics — combat, resources, turn structure, etc. Your job is: given a card's printed text, wire up its effect in the right place.

---

## The Mental Model

Every card effect falls into one of two categories:

1. **Auto-resolve** — the engine applies the effect immediately with no player input needed (create a token, draw a card, deal fixed damage). Return `null`.
2. **Pending** — the effect requires the player to make a choice (pick a target, say yes/no, choose cards from hand). Return a `PendingResolution` object.

The engine is a state machine. When you return a pending object, the client is shown a prompt. When the player responds, `dispatch-listener.ts` routes to the right handler and resolves the effect. Your job is to set up the initial pending state correctly — the dispatch layer handles the rest once the player responds.

---

## Where to Add Code

There are three files you will touch, plus one for tests:

| File | What goes here |
|---|---|
| `src/server/engine/actions/when-played.ts` | When Played abilities for units and events |
| `src/server/engine/actions/when-defeated.ts` | When Defeated abilities |
| `src/server/engine/actions/on-attack.ts` | On Attack ability resolution |
| `src/server/engine/core-functions.ts` | On Attack registration (`HasOnAttack` / `UpgradeGrantsOnAttack`) |
| `src/server/engine/dispatch-listener.ts` | Effect resolution when a target is chosen (add a `case` in `applyAbilityEffect`) |
| `tests/unit/<set>/` | Tests for your card |

### When do you need to touch `dispatch-listener.ts`?

Only when your card returns an `ability-target` pending that needs custom resolution logic. Simple cases (defeat the target, give it a shield, give it XP) are already handled generically. Complex cases (conditional effects, multi-step targeting, game-state mutation) need a `case "YOUR_CARD_ID":` in `applyAbilityEffect`.

If your card:
- Creates tokens → just call the token helper and `return null`
- Deals damage to the base → modify `game.currentGameState.player1.base.damage` and `return null`
- Gives a Shield token to a chosen unit → use `ability-target` and handle in `applyAbilityEffect`
- Has a yes/no choice → use `ability-option`

---

## File Anatomy

### `when-played.ts`

```ts
export function resolveWhenPlayed(
  cardId: string,
  player: PlayerId,
  playId?: string,   // the play instance ID of the card being played (for self-referencing effects)
): PendingResolution | null {
  const game = GetGame();
  switch (cardId) {
    case "YOUR_CARD_ID": {
      // your implementation
      return null; // or a PendingResolution
    }
    default:
      return null;
  }
}
```

`playId` is the unique runtime ID of this instance of the card. Use it as `sourcePlayId` when you need to reference the card itself in a follow-up effect (e.g. "move this unit to the ground arena").

### `when-defeated.ts`

```ts
export function resolveWhenDefeated(
  unit: Unit,      // the unit that was just defeated (already removed from arena)
  player: PlayerId,
): PendingResolution | null {
```

The unit is already off the board when this runs. Use `unit.cardId` to switch, `unit.playId` as `sourcePlayId` if needed.

### `on-attack.ts` — `resolveOnAttackTrigger`

On-attack effects fire after the attacker is chosen but before combat resolves. Always pass `continuation` through — never drop it.

`resolveOnAttackTrigger` has three sections in order:

1. **Effect-granted** — a `for` loop over current effects with a `switch`. Add your case here if a current-effect card grants a temporary on-attack ability.
2. **Upgrade-granted** — a `for` loop over `activeUpgrades` (pre-filtered by `UpgradeGrantsOnAttack`) with a `switch`. Add your case here for upgrade cards that grant on-attack abilities.
3. **Innate** — a `switch` on `attacker.cardId`. Add your case here for unit/leader cards whose own text says "On Attack:".

**Registration is required** — the engine only calls `resolveOnAttackTrigger` when the unit has an on-attack ability. You must register yours or it will never fire:

- **Innate ability** (the card's own text): add the `cardId` to the `switch` in `HasOnAttack` in `core-functions.ts`.
- **Upgrade-granted ability**: add the upgrade `cardId` to the `switch` in `UpgradeGrantsOnAttack` in `core-functions.ts`.
- **Effect-granted ability**: add the effect `cardId` to `EffectGrantsOnAttack` in `core-functions.ts`.

### `dispatch-listener.ts` — `applyAbilityEffect`

Called when the player picks a target for an `ability-target` pending. Add a `case` before `default:`:

```ts
function applyAbilityEffect(
  pending: AbilityTargetPending,
  targetIsBase: boolean,
  targetPlayId?: string,
): PendingResolution | null {
  const game = GetGame()!;
  switch (pending.cardId) {
    // ... existing cases ...
    case "YOUR_CARD_ID": {
      if (!targetPlayId) break;
      const target = unitByPlayId(game.currentGameState, targetPlayId);
      if (!target) break;
      // do the thing
      break; // falls through to sweepDeadUnits + continuation
    }
    default:
      // ...
  }
  return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
}
```

Use `game.currentGameState` (the `GameState`) for all state reads and writes. Use `game.gameLog` for log messages. When you `break`, execution falls through to `sweepDeadUnits`, which handles cleaning up dead units and returns `pending.continuation`. If you need to return a different next pending, `return` explicitly instead of `break`.

---

## PendingResolution Types

Pick the type that matches what the player needs to decide.

### `ability-target` — pick a unit from a list

```ts
return {
  type: "ability-target",
  cardId,           // your card ID — routes to applyAbilityEffect
  player,           // the player making the choice (optional but recommended)
  fromPlayIds: eligibleUnits.map(u => u.playId),
  continuation: null,
};
```

If the effect has multiple sequential steps (pick unit A, then pick unit B), nest them via `continuation`:

```ts
return {
  type: "ability-target",
  cardId,
  fromPlayIds: step1Ids,
  continuation: {
    type: "ability-target",
    cardId,
    fromPlayIds: step2Ids,
    continuation: null,
  },
};
```

In `applyAbilityEffect`, distinguish steps by checking `pending.sourcePlayId` (set it in step 1's result to carry the chosen unit into step 2).

### `ability-option` — yes/no choice

```ts
return {
  type: "ability-option",
  cardId,
  sourcePlayId: playId,   // optional: the card doing the offering
  helperText: "Deal 2 damage to an enemy unit?",
  onYes: {
    type: "ability-target",
    cardId,
    fromPlayIds: enemyPlayIds,
    continuation: null,
  },
  continuation: null,
};
```

If YES has no follow-up target selection (e.g. a direct inline effect), set `onYes: null` and add a `case` in `applyAbilityOptionEffect` instead:

```ts
// in applyAbilityOptionEffect:
case "YOUR_CARD_ID": {
  // apply inline effect using pending.sourcePlayId, game, log
  return pending.continuation ?? null;
}
```

### `spread-damage` — deal N damage split among units

```ts
return {
  type: "spread-damage",
  cardId,
  player,
  totalDamage: 5,
  optional: false,  // true = "you may", false = must assign all
  eligiblePlayIds: enemyUnits.map(u => u.playId),
  continuation: null,
} satisfies SpreadDamagePending;
```

### `return-from-discard` — return up to N cards from discard

```ts
return {
  type: "return-from-discard",
  cardId,
  player,
  maxCount: 3,
  eligiblePlayIds: discardedPlayIds,
  continuation: null,
} satisfies ReturnFromDiscardPending;
```

### `give-xp-multiple` — give XP to up to N units

```ts
return {
  type: "give-xp-multiple",
  cardId,
  player,
  maxCount: 3,
  eligiblePlayIds: trooperPlayIds,
  continuation: null,
} satisfies GiveXpMultiplePending;
```

### `choose-indirect-target` — deal indirect damage to a player

```ts
return {
  type: "choose-indirect-target",
  cardId,
  sourcePlayer: player,
  totalDamage: 5,
} satisfies ChooseIndirectTargetPending;
```

---

## Useful Helpers

### Card DB lookups (`src/server/engine/card-db/generated.ts`)

```ts
CardTitle(cardId)           // display name: "Battlefield Marine"
CardCost(cardId)            // resource cost: 2
CardType(cardId)            // "Unit" | "Event" | "Upgrade" | "Leader"
CardArena(cardId)           // "Ground" | "Space"
CardTraits(cardId)          // ["Rebel", "Trooper"]
CardAspects(cardId)         // ["Heroism", "Command"]
CardIsUnique(cardId)        // true | false
CardHp(cardId)
CardPower(cardId)
```

### Core helpers (`src/server/engine/core-functions.ts`)

```ts
GetGame()                               // returns Game wrapper (use .currentGameState for GameState)
GetUnitsForPlayer(player, readyOnly?)   // all units controlled by player
TraitContains(cardId, trait, controller?, playId?)   // check a unit's traits
CardIsLeader(cardId)                    // true for leader cards
```

### Inline state mutation (inside `when-played.ts` / `applyAbilityEffect`)

```ts
const gs = game.currentGameState;   // in dispatch-listener.ts use game.currentGameState
const pState = player === 1 ? gs.player1 : gs.player2;

// Damage
unit.damage += 3;

// Give Shield token
unit.upgrades.push({
  cardId: "SOR_T02",
  playId: nextPlayId(gs),
  owner: player,
  controller: player,
});

// Give Experience token
unit.upgrades.push({
  cardId: "SOR_T01",
  playId: nextPlayId(gs),
  owner: unit.owner,
  controller: unit.controller,
});

// Exhaust resources
exhaustResources(gs, player, 2);
```

### Token helpers (`src/server/engine/token-helpers.ts`)

```ts
CreateBattleDroid(gs, player)   // creates + places in correct arena
CreateCloneTrooper(gs, player)
CreateXWing(gs, player)
CreateSpy(gs, player)
```

### Logging

```ts
// in when-played.ts (game is the Game wrapper):
game.gameLog.push(`${CardTitle(cardId)}: something happened.`);

// in applyAbilityEffect (same):
game.gameLog.push(`...`);
```

---

## Step-by-Step Recipe

### 1. Read the card text carefully

Identify:
- **Trigger**: When Played / When Defeated / On Attack / Action [Exhaust]
- **Choice required?** Yes/No prompt, target selection, or fully automatic?
- **Effect**: What changes in game state?

### 2. Add a case in the right actions file

**When Played** → `when-played.ts`, inside `resolveWhenPlayed`'s switch.

**When Defeated** → `when-defeated.ts`, inside `resolveWhenDefeated`'s switch.

**On Attack** → two steps:
1. Register in `core-functions.ts`: add to `HasOnAttack` (innate), `UpgradeGrantsOnAttack` (upgrade), or `EffectGrantsOnAttack` (effect-granted).
2. Add resolution logic in `on-attack.ts` inside the matching section of `resolveOnAttackTrigger` (innate switch, upgrade loop, or effect loop).

**Leader Action** → `dispatch-listener.ts`, inside `resolveActionAbility`'s switch.

### 3. If you return an `ability-target`, add resolution logic

Add a `case "YOUR_CARD_ID":` inside `applyAbilityEffect` in `dispatch-listener.ts`. This is where you apply the actual effect after the player picks a target.

### 4. Write tests

Create `tests/unit/<set>/<card-title>.test.ts`. File name should match the card's title in kebab-case. Set folder matches the card's expansion (sor, shd, twi, jtl, lof, law, sec…).

```
tests/unit/sor/rebel-assault.test.ts
tests/unit/twi/admiral-trench.test.ts
tests/unit/jtl/blue-leader.test.ts
```

### 5. Run tests

```bash
npm test                                              # all tests
npx vitest run tests/unit/sor/your-card.test.ts      # single file
```

---

## Test Structure

```ts
import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_103 Rebel Assault", () => {
  it("lets the player attack twice with Rebel units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.events.sor.rebelAssault)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // ... choose targets and assert
  });
});
```

### `GameStateBuilder` key methods

```ts
.MyBase(cardId)
.TheirBase(cardId)
.MyLeader(cardId)
.TheirLeader(cardId)
.FillResourcesForPlayer(player, resourceCardId, count)
.WithCardInHandForPlayer(player, cardId)
.WithGroundUnitForPlayer(player, cardId, ready?, damage?)
.WithSpaceUnitForPlayer(player, cardId, ready?, damage?)
.WithUpgradesOnGroundUnitForPlayer(player, unitIndex, [GameStateBuilder.Upgrade("SOR_T02", player)])
.WithCardInDeckForPlayer(player, cardId)
.Build()   // returns GameState
```

### `GameTestAdapter` key methods

```ts
g.loadNewState(state)

// Play cards
await g.playCardFromHandAsync(player, handIndex)

// Choose targets
await g.chooseGroundUnitAsync(player, unitIndex)
await g.chooseSpaceUnitAsync(player, unitIndex)
await g.chooseLeaderAsync(player)
await g.chooseBaseAsync(fromPlayer, targetPlayer)

// Options
await g.chooseYesAsync(player)
await g.chooseNoAsync(player)

// Leader
await g.useLeaderAbilityAsync(player)
await g.deployLeaderAsync(player)

// Attack
await g.attackWithGroundUnitAsync(player, unitIndex)
await g.attackWithSpaceUnitAsync(player, unitIndex)

// State
g.state          // current GameState
g.lastDispatchResponse?.invalidAction   // true if last action was rejected
```

### Always use `Cards` constants — never raw strings

```ts
// ✅ correct
Cards.units.sor.battlefieldMarine
Cards.leaders.twi.countDooku

// ❌ wrong — card IDs change between sets, this will silently break
"SOR_095"
"TWI_005"
```

---

## Real Examples

### Auto-resolve: Create tokens

```ts
// when-played.ts
case "TWI_237": { // Droid Deployment — "Create 2 Battle Droid tokens."
  const gs = game.currentGameState;
  CreateBattleDroid(gs, player);
  CreateBattleDroid(gs, player);
  game.gameLog.push(`${CardTitle(cardId)}: 2 Battle Droid tokens created.`);
  return null;
}
```

### Yes/No then pick a target

```ts
// when-played.ts
case "SOR_162": { // Disabling Fang Fighter — "You may defeat an upgrade."
  const allUpgradePlayIds = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
    .flatMap(u => u.upgrades.map(upg => upg.playId));
  if (allUpgradePlayIds.length === 0) return null;
  return {
    type: "ability-option",
    cardId,
    sourcePlayId: playId,
    helperText: "Defeat an upgrade?",
    onYes: {
      type: "ability-target",
      cardId,
      player,
      fromPlayIds: allUpgradePlayIds,
      continuation: null,
    },
    continuation: null,
  };
}

// dispatch-listener.ts — applyAbilityEffect
case "SOR_162": {
  if (!targetPlayId) break;
  // defeat the chosen upgrade
  for (const unit of [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]) {
    const idx = unit.upgrades.findIndex(u => u.playId === targetPlayId);
    if (idx !== -1) {
      const upg = unit.upgrades.splice(idx, 1)[0];
      game.gameLog.push(`${CardTitle(upg.cardId)} was defeated.`);
      break;
    }
  }
  break;
}
```

### When Defeated — give XP token to a unit

```ts
// when-defeated.ts
case "SOR_108": { // Vanguard Infantry — "When Defeated: You may give an Experience token to a unit."
  const allUnits = [...gs.player1.groundArena, ...gs.player1.spaceArena,
                    ...gs.player2.groundArena, ...gs.player2.spaceArena];
  if (allUnits.length === 0) return null;
  return {
    type: "ability-option",
    cardId: "SOR_108",
    helperText: "Give an Experience token to a unit?",
    onYes: {
      type: "ability-target",
      cardId: "SOR_108",
      player,
      fromPlayIds: allUnits.map(u => u.playId),
      continuation: null,
    },
    continuation: null,
  };
}

// dispatch-listener.ts — applyAbilityEffect
case "SOR_108": {
  if (!targetPlayId) break;
  const target = unitByPlayId(game.currentGameState, targetPlayId);
  if (target) {
    target.upgrades.push({
      cardId: "SOR_T01",
      playId: nextPlayId(game.currentGameState),
      owner: target.owner,
      controller: target.controller,
    });
    game.gameLog.push(`${CardTitle("SOR_108")}: gave an Experience token to ${CardTitle(target.cardId)}.`);
  }
  break;
}
```

### Leader Action ability

```ts
// dispatch-listener.ts — resolveActionAbility
case "TWI_005": { // Count Dooku — "Play a Separatist card from hand. It gains Exploit 1."
  const separatistInHand = ps(game, player).hand
    .some(c => TraitContains(c.cardId, "Separatist"));
  if (!separatistInHand) {
    log.push(`${CardTitle("TWI_005")}: no Separatist cards in hand.`);
    return null;
  }
  return { type: "play-from-hand", cardId: "TWI_005", player };
}
```

---

## What NOT to Touch

- `src/server/engine/card-db/generated.ts` — auto-generated, do not edit
- `src/server/engine/dispatch-listener.ts` outside of `applyAbilityEffect`, `applyAbilityOptionEffect`, `applyAbilityOptionDeclineEffect`, and `resolveActionAbility` — core mechanics live here
- `src/server/engine/pending-resolution.ts` — do not add new types; the existing generic types (`ability-target`, `ability-option`, etc.) cover all card effects via `cardId` routing
- `src/lib/` — client-facing types, do not change
- `src/server/engine/actions/bounty.ts` — add new bounty sources in `getBountyEffects` only if the card explicitly grants a Bounty keyword
