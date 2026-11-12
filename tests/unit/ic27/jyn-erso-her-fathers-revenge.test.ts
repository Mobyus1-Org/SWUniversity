import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// IC27_123 Jyn Erso — Her Father's Revenge (8/7 Ground, cost 8, Aggression/Heroism)
//   "Saboteur. When Played: Ready up to 3 units with combined cost 7 or less. They each gain
//    Saboteur for this phase."  "Units" is unqualified — enemy units are legal.

const JYN = Cards.units.ic27.jynErso;
const CSF = Cards.units.sor.consularSecurityForce;      // cost 4
const MARINE = Cards.units.sor.battlefieldMarine;       // cost 2
const TROOPER = Cards.units.sor.deathStarStormtrooper;  // cost 1
const SWOOP = Cards.units.sor.swoopRacer;               // cost 3
const SNOKE = Cards.units.ic27.snoke;                   // cost 8 — over budget on its own

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, JYN)
    .WithGroundUnitForPlayer(1, CSF, false)
    .WithGroundUnitForPlayer(1, MARINE, false)
    .WithGroundUnitForPlayer(1, TROOPER, false)
    .WithGroundUnitForPlayer(1, SNOKE, false)
    .WithGroundUnitForPlayer(2, SWOOP, false);
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[]; maxTargets?: number } | undefined;
const p1 = (g: GameTestAdapter, cardId: string) => g.state.player1.groundArena.find(u => u.cardId === cardId)!;

describe("IC27_123 Jyn Erso — When Played", () => {
  it("offers every unit costing 7 or less, either side, up to 3 — not Jyn, not Snoke", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(res(g)?.maxTargets).toBe(3);
    expect([...(res(g)?.fromPlayIds ?? [])].sort()).toEqual(
      [p1(g, CSF).playId, p1(g, MARINE).playId, p1(g, TROOPER).playId, g.state.player2.groundArena[0].playId].sort());
  });

  it("4 + 2 + 1 = 7: all three ready and gain Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [p1(g, CSF).playId, p1(g, MARINE).playId, p1(g, TROOPER).playId] });

    for (const id of [CSF, MARINE, TROOPER]) {
      expect(p1(g, id).ready).toBe(true);
      expect(HasSaboteur(id, p1(g, id).playId, 1)).toBe(true);
    }
    expect(p1(g, SNOKE).ready).toBe(false);
    expect(HasSaboteur(SNOKE, p1(g, SNOKE).playId, 1)).toBe(false);
  });

  it("a combined 9 is refused and nothing changes", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [p1(g, CSF).playId, p1(g, MARINE).playId, g.state.player2.groundArena[0].playId],
    });

    expect(p1(g, CSF).ready).toBe(false);
    expect(g.state.player2.groundArena[0].ready).toBe(false);

    // Still waiting: a legal pick afterwards resolves.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [p1(g, CSF).playId] });
    expect(p1(g, CSF).ready).toBe(true);
  });

  it("an enemy unit can be readied and gains Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    const swoop = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [swoop] });

    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(HasSaboteur(SWOOP, swoop, 2)).toBe(true);
  });

  it("'up to' — choosing none is legal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(res(g)).toBeFalsy();
    expect(p1(g, CSF).ready).toBe(false);
  });

  it("has Saboteur printed", () => {
    expect(HasSaboteur(JYN)).toBe(true);
  });
});
