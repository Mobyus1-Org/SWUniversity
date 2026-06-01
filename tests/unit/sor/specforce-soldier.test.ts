import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_140 SpecForce Soldier — 2/2 Ground (Heroism), cost 1
// "When Played: A unit loses Sentinel for this phase."

describe("SOR_140 SpecForce Soldier", () => {
  it("removes Sentinel from a chosen unit for the phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.specForceSoldier)
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // has Sentinel
      .Build();
    g.loadNewState(state);

    const sentinelPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [sentinelPlayId] });

    expect(g.state.currentEffects.some(e => e.cardId === "SOR_140" && e.targetPlayId === sentinelPlayId)).toBe(true);
  });

  it("fires a choose-target prompt when played", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.specForceSoldier)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });
});
