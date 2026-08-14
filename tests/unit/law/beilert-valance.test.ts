import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_051 Beilert Valance — Target: Vader (3/6 Ground) —
// "On Attack: Draw a card. You may deal damage to a ground unit equal to the number of cards
//  you've drawn this phase."
//
// The count INCLUDES this ability's own draw, so a first attack with no prior draws deals 1.
function setup(deckSize = 6) {
  let builder = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithGroundUnitForPlayer(1, Cards.units.law.beilertValance)
    // A 3/7 target that survives several points of damage so the amount is observable.
    .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce);

  for (let i = 0; i < deckSize; i++) {
    builder = builder.WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
  }

  const g = new GameTestAdapter();
  g.loadNewState(builder.Build());
  return g;
}

describe("LAW_051 Beilert Valance", () => {
  it("On Attack: draws a card", async () => {
    const g = setup();
    const before = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(before + 1);
  });

  it("deals damage equal to the cards drawn this phase", async () => {
    const g = setup();

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // Only this ability's own draw has happened this phase.
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("declining deals no damage", async () => {
    const g = setup();

    await g.attackWithGroundUnitAsync(1, 0);
    const attacked = await g.chooseBaseAsync(1, 2);
    // Dispatching an option with no pending is a silent no-op, so prove the prompt exists.
    expect(attacked.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    const res = await g.chooseNoAsync(1);

    expect(res.state.player2.groundArena[0].damage).toBe(0);
  });

  // "a ground unit" — a space unit must not be a legal target.
  it("offers only ground units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.law.beilertValance)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(2, Cards.units.law.mercenaryFleet)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const res = await g.chooseYesAsync(1);

    const resolution = res.lastDispatchResponse?.resolutionNeeded;
    const offered = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];
    expect(offered).toContain(g.state.player2.groundArena[0].playId);
    expect(offered).not.toContain(g.state.player2.spaceArena[0].playId);
  });

  // The count is cumulative across the phase, so a second attack in the same phase hits harder.
  it("counts earlier draws in the same phase", async () => {
    const g = setup();

    // First attack: draws 1, declines the damage.
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    // Ready Valance so he can attack again in the same phase.
    g.state.player1.groundArena[0].ready = true;
    await g.dispatchAsync(2, "pass-action", {});

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // Two draws this phase.
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
