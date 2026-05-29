import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 8)
    .MyLeader(Cards.leaders.sor.idenVersio)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("Iden Versio — Unit: When an enemy unit is defeated", () => {
  it("should heal 1 damage from your base when an enemy unit is defeated", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 8)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.takedown)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.idenVersio)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.discard.length).toBe(1);
    expect(g.state.player1.base.damage).toBe(7);
  });
});

describe("Iden Versio — Leader: Action [Exhaust]: If an enemy unit was defeated this phase, heal 1 damage from your base", () => {
  it("heals 1 damage from base when an enemy unit was defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.sor.takedown)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithInitiativePlayerBeing(2)
        .WithInitiativeClaimed()
        .Build()
    );
    // defeat an enemy unit first (player 2 auto-passes after, returning turn to player 1)
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    const damageAfterKill = g.state.player1.base.damage;
    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.base.damage).toBe(damageAfterKill - 1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("soft-passes (no heal) but still exhausts the leader when no enemy unit was defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const damageBefore = g.state.player1.base.damage;
    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.base.damage).toBe(damageBefore);
  });
});

describe("Iden Versio — Leader Deploy: Shielded", () => {
  it("enters play with a Shield token when deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    await g.deployLeaderAsync(1);
    const idenUnit = g.state.player1.groundArena[0];
    expect(idenUnit.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(true);
  });
});