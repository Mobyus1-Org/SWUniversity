import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_140 IG-2000 (Space) — "Overwhelm. When Played: Deal 1 damage to each of up to 3 units."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("JTL_140 IG-2000 — When Played", () => {
  it("deals 1 damage to each of the chosen units (up to 3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.ig2000)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)  // [0]
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // [1]
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // [2]
        .Build(),
    );
    const s = g.state;
    const ids = [s.player2.groundArena[0].playId, s.player2.groundArena[1].playId, s.player2.groundArena[2].playId];

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    expect(g.state.player2.groundArena.find(u => u.playId === ids[0])!.damage).toBe(1);
    expect(g.state.player2.groundArena.find(u => u.playId === ids[1])!.damage).toBe(1);
    expect(g.state.player2.groundArena.find(u => u.playId === ids[2])!.damage).toBe(1);
  });

  it("damages at most 3 units even if more are chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.ig2000)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .Build(),
    );
    const ids = g.state.player2.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids }); // 4 chosen

    const damaged = g.state.player2.groundArena.filter(u => u.damage > 0).length;
    expect(damaged).toBe(3);
  });

  it("choosing zero units deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.ig2000)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
