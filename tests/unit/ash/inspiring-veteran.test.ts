import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_205 Inspiring Veteran (3/3 Ground, cost 3) —
// "When Played: Give an Advantage token to each of up to 3 exhausted units."

function advantageCount(u: { upgrades: { cardId: string }[] }): number {
  return u.upgrades.filter(upg => upg.cardId === "ASH_T02").length;
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.ash.inspiringVeteran);
}

describe("ASH_205 Inspiring Veteran", () => {
  // Played units enter this engine's arena exhausted, so Inspiring Veteran itself is always
  // a legal (self) target the moment it enters play. With no other exhausted units around,
  // declining to spend any of the "up to 3" picks leaves everyone token-free.
  it("offers only itself when no other unit is exhausted, and declining gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true) // ready — not a candidate
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const veteranPlayId = g.state.player1.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(advantageCount(g.state.player2.groundArena[0])).toBe(0);
    expect(advantageCount(g.state.player1.groundArena.find(u => u.playId === veteranPlayId)!)).toBe(0);
  });

  it("gives an Advantage token to each chosen exhausted unit (across both players)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false) // exhausted [0]
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards, false) // exhausted [1] (friendly)
        .Build(),
    );
    const ids = [g.state.player2.groundArena[0].playId, g.state.player1.groundArena[0].playId];

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    expect(advantageCount(g.state.player2.groundArena.find(u => u.playId === ids[0])!)).toBe(1);
    expect(advantageCount(g.state.player1.groundArena.find(u => u.playId === ids[1])!)).toBe(1);
  });

  it("caps at 3 tokens even when more than 3 exhausted units are chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false)
        .Build(),
    );
    const ids = g.state.player2.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    const rewarded = g.state.player2.groundArena.filter(u => advantageCount(u) > 0).length;
    expect(rewarded).toBe(3);
  });
});
