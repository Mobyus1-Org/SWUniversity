import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_153 Saw Gerrera
// — As an additional cost for each opponent to play an event, they must deal 2 damage to their base.

describe("SOR_153 Saw Gerrera", () => {
  it("deals 2 damage to opponent's base when they play an event", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.hanSolo) // Cunning+Heroism for Disarm
      .WithGroundUnitForPlayer(1, Cards.units.sor.sawGerrera)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    const sawGerreraPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [sawGerreraPlayId] });

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does not deal damage to its own controller's base when they play an event", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command+Villainy for StrikeTrue
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.hanSolo)
      .WithGroundUnitForPlayer(1, Cards.units.sor.sawGerrera)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
      .Build();
    g.loadNewState(state);

    const marine1PlayId = state.player1.groundArena[1].playId;
    const marine2PlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine1PlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine2PlayId] });

    expect(g.state.player1.base.damage).toBe(0);
  });

  it("opponent can still play events while Saw Gerrera is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.hanSolo)
      .WithGroundUnitForPlayer(1, Cards.units.sor.sawGerrera)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    const sawGerreraPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(2, 0);
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [sawGerreraPlayId] });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });
});
