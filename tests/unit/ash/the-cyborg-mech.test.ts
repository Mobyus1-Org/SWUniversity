import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_147 The Cyborg Mech (3/7 Ground, cost 6) —
// "Grit (This unit gets +1/+0 for each damage on it.)
//  When Played: Either deal 2 damage to an undamaged ground unit or 5 damage to a damaged ground unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_147 The Cyborg Mech — Grit", () => {
  it("gets +1/+0 for each damage on it", () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, Cards.units.ash.theCyborgMech, true, 3).Build();
    g.loadNewState(state);

    const mech = g.state.player1.groundArena[0];
    expect(Unit.FromInterface(mech).CurrentPower()).toBe(6); // 3 + 3 damage
  });
});

describe("ASH_147 The Cyborg Mech — When Played", () => {
  it("deals 2 damage to an undamaged ground unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.theCyborgMech)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // undamaged
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(2);
  });

  it("deals 5 damage to a damaged ground unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.theCyborgMech)
      .WithGroundUnitForPlayer(2, Cards.units.sor.atAtSuppressor, true, 1) // already damaged, 8 HP
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(6); // 1 existing + 5
  });

  it("does not offer a space unit as a target", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.theCyborgMech)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const spacePlayId = state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spacePlayId] });

    expect(resp.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
