import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_033 Grand Admiral Thrawn (5/7 Ground, cost 7)
// "Support (…)"
// "When Attack Ends: If the defending unit was defeated, ready this unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_033 Grand Admiral Thrawn", () => {
  it("readies himself after defeating the defending unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.grandAdmiralThrawn)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3, dies to 5 power
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].ready).toBe(true); // readied again
  });

  it("stays exhausted when the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.grandAdmiralThrawn)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4/6, survives 5
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("Support grants it — the supported attacker readies after a kill", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        // A 0-power, 3-HP defender: the Marine kills it and takes no counter-damage, so it
        // survives to have its granted "When Attack Ends" fire.
        .WithGroundUnitForPlayer(2, Cards.units.ash.emperorsMessenger)
        .WithCardInHandForPlayer(1, Cards.units.ash.grandAdmiralThrawn)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(marine.ready).toBe(true); // attacked, then readied by the granted ability
  });
});
