import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_236 Far Far Away (Event, cost 3)
// "Return a friendly non-leader unit to its owner's hand. If you do, return an enemy non-leader
//  unit to its owner's hand."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_236 Far Far Away", () => {
  it("returns a friendly unit and then an enemy unit to their owners' hands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.farFarAway)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
  });

  it("still returns the friendly unit when the opponent has no non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.farFarAway)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("does nothing at all when the caster has no non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.farFarAway)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1); // the enemy unit is untouched
  });

  it("cannot target a leader unit on either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano) // friendly leader unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano) // enemy leader unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithCardInHandForPlayer(1, Cards.events.ash.farFarAway)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const friendlyTargets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(friendlyTargets).toEqual([
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId,
    ]);

    await g.chooseGroundUnitAsync(1, 1);
    const enemyTargets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(enemyTargets).toEqual([
      g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!.playId,
    ]);
  });

  it("returns a unit to its OWNER's hand, not the caster's", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.ash.farFarAway)
      // A unit player 1 controls (so it sits in their arena) but player 2 still owns — the
      // shape a take-control effect leaves behind.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    state.player1.groundArena[0].owner = 2;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // the controlled-but-enemy-owned unit is "friendly"
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player1.hand).toHaveLength(0);
  });
});
