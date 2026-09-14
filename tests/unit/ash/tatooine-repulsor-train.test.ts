import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameState } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// ASH_035 Tatooine Repulsor Train (Unit 8/7 Ground Vehicle, cost 7, Command/Aggression)
//   "This unit can't be attacked while you control 2 or more exhausted units (unless it gains
//    Sentinel).
//    On Attack: Deal 2 damage to a ground unit for each friendly exhausted unit."
//
// The Train counts itself — an attacking unit is an exhausted friendly unit.

const TRAIN = Cards.units.ash.tatooineRepulsorTrain;
const MARINE = Cards.units.sor.battlefieldMarine;
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7
const GUNSHIP = Cards.units.sor.strafingGunship;       // space unit that can attack ground units

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

/** Player 2 attacks with its ground unit 0; returns the unit targets offered. */
async function targetsForP2Attack(state: GameState, arena: "ground" | "space" = "ground") {
  const g = new GameTestAdapter();
  g.loadNewState(state);
  if (arena === "ground") await g.attackWithGroundUnitAsync(2, 0);
  else await g.attackWithSpaceUnitAsync(2, 0);
  const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
  return { g, ids: res?.fromPlayIds ?? [] };
}

describe("ASH_035 Tatooine Repulsor Train — can't be attacked", () => {
  function defending(exhaustedFriends: number, trainReady = true) {
    const b = base().WithActivePlayer(2).WithGroundUnitForPlayer(1, TRAIN, trainReady);
    for (let i = 0; i < exhaustedFriends; i++) b.WithGroundUnitForPlayer(1, MARINE, false);
    return b.WithGroundUnitForPlayer(2, DURABLE).Build();
  }

  it("with 2 exhausted friendly units, it can't be attacked (the others still can)", async () => {
    const state = defending(2);
    const { ids } = await targetsForP2Attack(state);
    expect(ids).not.toContain(state.player1.groundArena[0].playId);
    expect(ids).toContain(state.player1.groundArena[1].playId);
  });

  it("with only 1 exhausted friendly unit, it can be attacked", async () => {
    const state = defending(1);
    const { ids } = await targetsForP2Attack(state);
    expect(ids).toContain(state.player1.groundArena[0].playId);
  });

  it("an exhausted Train counts itself toward the 2", async () => {
    const state = defending(1, false);
    const { ids } = await targetsForP2Attack(state);
    expect(ids).not.toContain(state.player1.groundArena[0].playId);
  });

  it("unless it gains Sentinel — then it can (and must) be attacked", async () => {
    const state = defending(2);
    state.currentEffects.push({ cardId: "TWI_074", duration: "Phase", affectedPlayer: 1, targetPlayId: state.player1.groundArena[0].playId });
    const { ids } = await targetsForP2Attack(state);
    expect(ids).toEqual([state.player1.groundArena[0].playId]);
  });

  it("a unit attacking across arenas can't reach it either", async () => {
    const state = base()
      .WithActivePlayer(2)
      .WithGroundUnitForPlayer(1, TRAIN)
      .WithGroundUnitForPlayer(1, MARINE, false)
      .WithGroundUnitForPlayer(1, MARINE, false)
      .WithSpaceUnitForPlayer(2, GUNSHIP)
      .Build();
    const { ids } = await targetsForP2Attack(state, "space");
    expect(ids).not.toContain(state.player1.groundArena[0].playId);
    expect(ids).toContain(state.player1.groundArena[1].playId);
  });
});

describe("ASH_035 Tatooine Repulsor Train — On Attack", () => {
  function attacking(exhaustedFriends: number) {
    const b = base().WithActivePlayer(1).WithGroundUnitForPlayer(1, TRAIN);
    for (let i = 0; i < exhaustedFriends; i++) b.WithGroundUnitForPlayer(1, MARINE, false);
    return b
      .WithGroundUnitForPlayer(2, DURABLE)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .Build();
  }

  it("deals 2 per friendly exhausted unit — the attacking Train counts itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attacking(2)); // 2 exhausted Marines + the Train = 3 → 6 damage

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(6);
    expect(g.state.player2.base.damage).toBe(8);
  });

  it("alone, it still counts itself — 2 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attacking(0));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("offers any GROUND unit — both sides, the Train included — never space units", async () => {
    const g = new GameTestAdapter();
    const state = attacking(1);
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect([...(res.fromPlayIds ?? [])].sort()).toEqual([
      state.player1.groundArena[0].playId,
      state.player1.groundArena[1].playId,
      state.player2.groundArena[0].playId,
    ].sort());
  });
});
