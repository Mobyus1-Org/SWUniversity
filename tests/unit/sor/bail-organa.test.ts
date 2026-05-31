import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_094 Bail Organa — 1/2 Ground (Command+Heroism)
// Action [Exhaust]: Give an Experience token to another friendly unit.

describe("SOR_094 Bail Organa", () => {
  it("gives an Experience token to another friendly unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bailOrgana)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const bailPlayId = state.player1.groundArena[0].playId;
    const marinePlayId = state.player1.groundArena[1].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.bailOrgana, playId: bailPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId);
    expect(marine?.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length).toBe(1);
    const bail = g.state.player1.groundArena.find(u => u.playId === bailPlayId);
    expect(bail?.ready).toBe(false); // exhausted
  });

  it("cannot give XP to itself", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bailOrgana)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const bailPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.bailOrgana, playId: bailPlayId });
    // Try to target Bail himself — should be invalid
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [bailPlayId] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("action not available when no other friendly units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bailOrgana)
      .Build();
    g.loadNewState(state);
    const bailPlayId = state.player1.groundArena[0].playId;

    const result = await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.bailOrgana, playId: bailPlayId });

    // No other units — action should be unavailable
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
