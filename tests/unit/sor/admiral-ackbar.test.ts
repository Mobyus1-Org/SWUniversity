import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_097 Admiral Ackbar (Ground, 1/4, Restore 1) —
// "When Played: You may deal damage to a unit equal to the number of units you control in its arena."
describe("SOR_097 Admiral Ackbar — When Played damage", () => {
  it("deals damage to a chosen unit equal to friendly units in that unit's arena", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 1 friendly ground unit
      .WithCardInHandForPlayer(1, Cards.units.sor.admiralAckbarSor)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP target, survives to read exact damage
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // Friendly ground units after Ackbar enters = Battlefield Marine + Ackbar = 2
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("deals no damage when the player declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.admiralAckbarSor)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
