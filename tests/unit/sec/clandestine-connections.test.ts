import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SEC_264 Clandestine Connections", () => {
  it("On Attack: pays 2 with Credits and deals 2 damage to a chosen base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCreditsForPlayer(1, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.sec.clandestineConnections, playId: "@", owner: 1, controller: 1 },
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the enemy Marine
    await g.chooseOptionAsync(1, "Yes"); // SEC_264: pay 2 to deal 2 to a base
    // No Credit prompt: with no resources at all, defeating 2 Credits is the only
    // way to pay the 2 — a forced spend, so the engine takes it without asking.
    // Base selection via the UI path (the real client sends targetZones, not a playId).
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });

    expect(g.state.player1.supplemental.creditTokens).toBe(3); // 5 - 2
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("On Attack: pays 2 with resources when no Credits are held", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.sec.clandestineConnections, playId: "@", owner: 1, controller: 1 },
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "Yes"); // pay 2 (no Credits → resources, no Use-Credits prompt)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(3); // 5 - 2
  });

  it("On Attack: can be declined", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCreditsForPlayer(1, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.sec.clandestineConnections, playId: "@", owner: 1, controller: 1 },
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "No"); // skip the ability

    expect(g.state.player1.supplemental.creditTokens).toBe(5);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
