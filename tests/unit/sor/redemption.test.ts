import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_052 Redemption", () => {
  it("heals a unit and deals that amount back to itself", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.redemption)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: marinePlayId, damage: 3 }],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.spaceArena[0].damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("heals a base and deals that amount back to itself", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.redemption)
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 5;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: "player1.base", damage: 5 }],
    });

    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player1.spaceArena[0].damage).toBe(5);
  });

  it("heals multiple targets and deals total back to itself", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.redemption)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1)
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 3;

    const marine1PlayId = state.player1.groundArena[0].playId;
    const marine2PlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: marine1PlayId, damage: 2 },
        { playId: marine2PlayId, damage: 1 },
        { playId: "player1.base", damage: 3 },
      ],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player1.spaceArena[0].damage).toBe(6); // 2 + 1 + 3
  });

  it("rebound equals exactly what was healed, not the maximum", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.redemption)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: marinePlayId, damage: 2 }],
    });

    expect(g.state.player1.spaceArena[0].damage).toBe(2); // 2, not 8
  });

  it("rejects assigning more than current damage on a heal target", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.redemption)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 1)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const result = await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: marinePlayId, damage: 3 }],
    });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena[0].damage).toBe(1); // unchanged
  });

  it("no rebound when zero damage healed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.redemption)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(2); // untouched
    expect(g.state.player1.spaceArena[0].damage).toBe(0);  // no rebound
  });
});
