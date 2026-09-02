import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// HMW_121 Hijacked AT-ST (7/7 Ground, cost 5, Command/Heroism, Rebel/Vehicle/Walker) —
//   "Overwhelm"
//   "When Played: This unit doesn't ready during the next regroup phase."
//
// The second clause is a lasting restriction, not a keyword: it has to survive from the moment
// the AT-ST is played, through the rest of the action phase, and into the regroup READY step —
// then stop. A Round-duration effect does exactly that, because executeRegroupReady readies every
// unit BEFORE it clears Phase- and Round-scoped effects.
//
// It is the AT-ST's OWN readying that is blocked, so the effect is keyed to its playId; a second
// copy played later must still ready normally.

const AT_ST = "HMW_121";
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — covers the AT-ST
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(2, MARINE)
    .WithCardInDeckForPlayer(2, MARINE)
    .WithActivePlayer(1);
}

/**
 * Passes the round out and answers both resource steps, landing in the next action phase.
 *
 * Passes as whoever is ACTIVE rather than 1-then-2: after a card is played the turn has already
 * moved on, and a pass from the wrong player is silently rejected — which leaves the round
 * unfinished and reads exactly like a unit failing to ready.
 */
async function passTheRound(g: GameTestAdapter) {
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.passResourceAsync(g.state.activePlayer);
  await g.passResourceAsync(g.state.activePlayer);
}

const atSt = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === AT_ST)!;

describe("HMW_121 Hijacked AT-ST", () => {
  it("has Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, AT_ST).Build());
    const u = g.state.player1.groundArena[0];

    expect(HasOverwhelm(u.cardId, u.playId, 1)).toBe(true);
  });

  it("Overwhelm spills excess damage to the base in real combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, AT_ST)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(4); // 7 power - 3 HP
  });

  it("does NOT ready during the next regroup phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, AT_ST).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(atSt(g).ready).toBe(false); // units enter play exhausted

    await passTheRound(g);

    expect(atSt(g).ready).toBe(false); // still exhausted — the restriction held
  });

  it("readies normally the round AFTER that", async () => {
    const g = new GameTestAdapter();
    let b = setup().WithCardInHandForPlayer(1, AT_ST);
    for (let i = 0; i < 6; i++) b = b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
    g.loadNewState(b.Build());

    await g.playCardFromHandAsync(1, 0);
    await passTheRound(g);
    expect(atSt(g).ready).toBe(false);

    await passTheRound(g); // second regroup — the restriction is spent
    expect(atSt(g).ready).toBe(true);
  });

  it("only the played AT-ST is held — an existing unit readies as usual", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(1, AT_ST)
        .WithGroundUnitForPlayer(1, MARINE, false) // already exhausted, unrelated
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await passTheRound(g);

    expect(atSt(g).ready).toBe(false);
    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(true);
  });

  it("an AT-ST already in play, never played this round, readies normally", async () => {
    // The restriction comes from the When Played trigger, not from being an AT-ST.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, AT_ST, false).Build());

    await passTheRound(g);

    expect(atSt(g).ready).toBe(true);
  });
});
