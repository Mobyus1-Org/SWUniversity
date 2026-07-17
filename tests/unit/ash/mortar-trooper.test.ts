import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_142 Mortar Trooper (Ground, cost 2) —
// "Action [Exhaust]: Deal 1 damage to each of up to 3 ground units."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("ASH_142 Mortar Trooper", () => {
  it("deals 1 damage to each of up to 3 chosen ground units and exhausts", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.mortarTrooper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // [0]
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // [1]
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [2] friendly, also eligible
      .Build();
    g.loadNewState(state);

    const trooperPlayId = state.player1.groundArena[0].playId;
    const ids = [
      state.player2.groundArena[0].playId,
      state.player2.groundArena[1].playId,
      state.player1.groundArena[1].playId,
    ];

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.mortarTrooper, playId: trooperPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    for (const id of ids) {
      const u = [...g.state.player1.groundArena, ...g.state.player2.groundArena].find(x => x.playId === id)!;
      expect(u.damage).toBe(1);
    }
    const trooper = g.state.player1.groundArena.find(u => u.playId === trooperPlayId)!;
    expect(trooper.ready).toBe(false);
  });

  it("damages at most 3 units even if more ground units are chosen", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.mortarTrooper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    const trooperPlayId = state.player1.groundArena[0].playId;
    const ids = state.player2.groundArena.map(u => u.playId);

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.mortarTrooper, playId: trooperPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    const damaged = g.state.player2.groundArena.filter(u => u.damage > 0).length;
    expect(damaged).toBe(3);
  });

  it("does not offer a space unit as a target", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.mortarTrooper)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const trooperPlayId = state.player1.groundArena[0].playId;
    const spacePlayId = state.player2.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.mortarTrooper, playId: trooperPlayId });
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spacePlayId] });

    expect(resp.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
