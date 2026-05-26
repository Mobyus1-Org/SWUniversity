import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_034 Del Meeko
// — Restore 1 (When this unit attacks, heal 1 damage from your base.)
// — Each event an opponent plays costs [1 resource] more.

describe("SOR_034 Del Meeko", () => {
  it("Restore 1: heals 1 damage from own base on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.shd.moffGideon)
        .WithGroundUnitForPlayer(1, Cards.units.sor.delMeeko)
        .Build(),
    );

    g.state.player1.base.damage = 5;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4); // healed 1 via Restore
  });

  it("opponent's event costs 1 more while Del Meeko is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.delMeeko)
        // Strike True (SOR_127) has Command aspect — no penalty with Tarkin + Command base
        // Normal cost = 3; with Del Meeko tax = 4
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    // Player 2 has exactly 3 resources — normally enough for Strike True, not enough with Del Meeko
    await g.dispatchAsync(2, "play-card", { cardId: Cards.events.sor.strikeTrue, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("opponent can play event when they have the extra resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.delMeeko)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 4)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    // 4 resources covers Strike True (3) + Del Meeko tax (1)
    await g.dispatchAsync(2, "play-card", { cardId: Cards.events.sor.strikeTrue, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("Del Meeko does not tax its own controller's events", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.delMeeko)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .Build(),
    );

    // Player 1 (Del Meeko's controller) should pay only 3, not 4
    await g.dispatchAsync(1, "play-card", { cardId: Cards.events.sor.strikeTrue, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });
});
