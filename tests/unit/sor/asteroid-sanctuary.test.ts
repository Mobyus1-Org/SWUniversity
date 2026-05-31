import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_218 Asteroid Sanctuary — Event (Cunning), cost 2
// "Exhaust an enemy unit. Give a Shield token to a friendly unit that costs 3 or less."

describe("SOR_218 Asteroid Sanctuary", () => {
  it("first prompts for an enemy unit to exhaust", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .WithCardInHandForPlayer(1, Cards.events.sor.asteroidSanctuary)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("exhausts the chosen enemy unit and then prompts for a friendly unit for Shield", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 3, eligible for shield
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .WithCardInHandForPlayer(1, Cards.events.sor.asteroidSanctuary)
      .Build();
    g.loadNewState(state);
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("gives a Shield token to the chosen friendly unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .WithCardInHandForPlayer(1, Cards.events.sor.asteroidSanctuary)
      .Build();
    g.loadNewState(state);
    const enemyPlayId = state.player2.groundArena[0].playId;
    const friendlyPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] });

    const friendly = g.state.player1.groundArena[0];
    expect(friendly.upgrades.some(u => u.cardId === "SOR_T02")).toBe(true);
  });
});
