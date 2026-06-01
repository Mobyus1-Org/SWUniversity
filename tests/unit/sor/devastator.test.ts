import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_090 Devastator (Inescapable) — 5/9 Space (Command+Villainy), cost 10
// "Sentinel. Overwhelm. When Played: You may deal damage to a unit equal to the number of resources you control."

describe("SOR_090 Devastator", () => {
  it("offers damage prompt when played with resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 11)
      .WithCardInHandForPlayer(1, Cards.units.sor.devastator)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("deals damage equal to resource count, defeating a unit with less HP", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 11)
      .WithCardInHandForPlayer(1, Cards.units.sor.devastator)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP < 11 damage
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // 11 damage kills the 9-HP walker
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("skips damage when player declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 11)
      .WithCardInHandForPlayer(1, Cards.units.sor.devastator)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
