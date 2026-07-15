import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_170 War Juggernaut (3/7 Ground) —
// "This unit gets +1/+0 for each damaged unit."
// "When Played: Deal 1 damage to each of any number of units."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("JTL_170 War Juggernaut", () => {
  it("gets +1/+0 for each damaged unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.jtl.warJuggernaut)
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards, true, 2) // damaged
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1)   // damaged
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)             // undamaged
        .Build(),
    );

    const juggernaut = Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === Cards.units.jtl.warJuggernaut)!);
    expect(juggernaut.CurrentPower()).toBe(5); // base 3 + 2 damaged units
  });

  it("When Played: deals 1 damage to each of any number of chosen units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.warJuggernaut)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)  // [0]
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // [1]
        .Build(),
    );
    const s = g.state;
    const t0 = s.player2.groundArena[0].playId;
    const t1 = s.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [t0, t1] });

    expect(g.state.player2.groundArena.find(u => u.playId === t0)!.damage).toBe(1);
    expect(g.state.player2.groundArena.find(u => u.playId === t1)!.damage).toBe(1);
  });

  it("When Played: choosing zero units deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.warJuggernaut)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
