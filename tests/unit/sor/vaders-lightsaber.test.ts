import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_136 Vader's Lightsaber — Upgrade (Aggression+Villainy), cost 3
// "Attach to a non-Vehicle unit. When Played: If attached unit is Darth Vader, you may deal 4 damage to a ground unit."

describe("SOR_136 Vader's Lightsaber", () => {
  it("prompts to deal 4 damage when attached to Darth Vader", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)       // Aggression base
      .MyLeader(Cards.leaders.sor.ig88)         // Aggression+Villainy — covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.vadersLightsaber)
      .WithGroundUnitForPlayer(1, Cards.units.sor.darthVaderLeaderUnit)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const vaderPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vaderPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("deals 4 damage to chosen ground unit when yes is selected", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.ig88)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.vadersLightsaber)
      .WithGroundUnitForPlayer(1, Cards.units.sor.darthVaderLeaderUnit)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    const vaderPlayId = state.player1.groundArena[0].playId;
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vaderPlayId] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("does nothing extra when attached to non-Vader unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.ig88)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.vadersLightsaber)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Vader
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
