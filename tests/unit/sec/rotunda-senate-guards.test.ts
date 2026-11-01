import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SEC_063 Rotunda Senate Guards (4/5 Ground, cost 4, Vigilance, Republic/Trooper)
//   "While this unit is undamaged, it gains Sentinel."
// The same text as SOR_048 Vigilant Honor Guards.

const GUARDS = Cards.units.sec.rotundaSenateGuards;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2)
    .WithGroundUnitForPlayer(1, GUARDS)
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
    .Build();
}

function loadWithDamage(damage: number) {
  const g = new GameTestAdapter();
  const state = board();
  state.player1.groundArena[0].damage = damage;
  g.loadNewState(state);
  return g;
}

describe("SEC_063 Rotunda Senate Guards — Sentinel while undamaged", () => {
  it("has Sentinel while undamaged", () => {
    const g = loadWithDamage(0);
    const u = g.state.player1.groundArena[0];
    expect(HasSentinel(u.cardId, u.playId, 1)).toBe(true);
  });

  it("loses Sentinel once damaged", () => {
    const g = loadWithDamage(1);
    const u = g.state.player1.groundArena[0];
    expect(HasSentinel(u.cardId, u.playId, 1)).toBe(false);
  });

  it("undamaged: an enemy attack can only target the Guards", async () => {
    const g = loadWithDamage(0);
    await g.attackWithGroundUnitAsync(2, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("damaged (control): the other unit becomes attackable too", async () => {
    const g = loadWithDamage(1);
    await g.attackWithGroundUnitAsync(2, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[1].playId);
  });
});
