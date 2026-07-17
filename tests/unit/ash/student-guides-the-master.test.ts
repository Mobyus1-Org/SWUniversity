import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_115 The Student Guides the Master (Event, cost 1, Command/Heroism) — "Give a friendly unit
// +1/+0 for this phase for each other friendly unit with less power than it."
//
// Power reference: Battle Droid (TWI_T01) 1/1, Clone Trooper (TWI_T02) 2/2,
// Battlefield Marine (SOR_095) 3/3, Academy Defense Walker (SOR_037) 5/5.

describe("ASH_115 The Student Guides the Master", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.ash.studentGuidesTheMaster);
  }

  it("no buff when there are no other friendly units", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const { Unit } = await import("@/server/engine/unit");
    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(Unit.FromInterface(marine).CurrentPower()).toBe(3);
  });

  it("buffs by the count of other friendly units with strictly less power", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.academyDefenseWalker) // 5 power — chosen
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // 1 power
      .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper) // 2 power
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power
      .Build();
    g.loadNewState(state);
    const walkerPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    const { Unit } = await import("@/server/engine/unit");
    const walker = g.state.player1.groundArena.find(u => u.playId === walkerPlayId)!;
    // 3 other friendly units, all with less power than 5 → +3/+0 → power 8.
    expect(Unit.FromInterface(walker).CurrentPower()).toBe(8);
  });

  it("a friendly unit with equal or higher power is not counted", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — chosen
      .WithGroundUnitForPlayer(1, Cards.units.sor.academyDefenseWalker) // 5 power — higher, not counted
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — equal, not counted
      .Build();
    g.loadNewState(state);
    const chosenPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [chosenPlayId] });

    const { Unit } = await import("@/server/engine/unit");
    const chosen = g.state.player1.groundArena.find(u => u.playId === chosenPlayId)!;
    expect(Unit.FromInterface(chosen).CurrentPower()).toBe(3);
  });

  it("enemy units are not counted", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — chosen
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // 1 power, friendly — counted
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1 power, enemy — not counted
      .Build();
    g.loadNewState(state);
    const chosenPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [chosenPlayId] });

    const { Unit } = await import("@/server/engine/unit");
    const chosen = g.state.player1.groundArena.find(u => u.playId === chosenPlayId)!;
    // Only 1 friendly unit counted → +1/+0 → power 4.
    expect(Unit.FromInterface(chosen).CurrentPower()).toBe(4);
  });
});
