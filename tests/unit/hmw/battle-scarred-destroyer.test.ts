import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_158 Battle-Scarred Destroyer (7/8 Space, cost 6, Aggression/Villainy)
//   "When Played: Deal 4 damage to a friendly unit."
//
// Mandatory — there is no pass. "A friendly unit" includes the Destroyer itself, which is in play
// when the ability resolves; enemy units are never offered.
const DESTROYER = Cards.units.hmw.battleScarredDestroyer;
const MARINE = Cards.units.sor.battlefieldMarine;           // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce;          // 3/7 Ground

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression/Villainy — no aspect penalty
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, DESTROYER)
    .WithActivePlayer(1);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const destroyer = (g: GameTestAdapter) => g.state.player1.spaceArena.find(u => u.cardId === DESTROYER);
const target = (g: GameTestAdapter, playId: string) =>
  g.dispatchAsync(1, "choose-target", { targetPlayIds: [playId] });

describe("HMW_158 Battle-Scarred Destroyer — When Played: deal 4 damage to a friendly unit", () => {
  it("offers every friendly unit including itself, no enemy, and no pass", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).Build());
    await g.playCardFromHandAsync(1, 0);

    const r = needs(g);
    expect(r?.type).toBe("Target");
    const ids = r?.type === "Target" ? (r.fromPlayIds ?? []) : [];
    expect(ids).toContain(g.state.player1.groundArena[0].playId);
    expect(ids).toContain(destroyer(g)!.playId);
    expect(ids).not.toContain(g.state.player2.groundArena[0].playId);
    expect(ids).toHaveLength(2);
    expect(r?.type === "Target" && r.optional).toBeFalsy();
  });

  it("deals 4 to the chosen friendly unit (a 3/3 is defeated)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());
    await g.playCardFromHandAsync(1, 0);
    await target(g, g.state.player1.groundArena[0].playId);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(destroyer(g)!.damage).toBe(0);
    expect(needs(g)).toBeFalsy();
  });

  it("can be pointed at itself — 4 damage on the Destroyer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());
    await g.playCardFromHandAsync(1, 0);
    await target(g, destroyer(g)!.playId);

    expect(destroyer(g)!.damage).toBe(4);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("with no other friendly unit it still has to hit itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, CSF).Build());
    await g.playCardFromHandAsync(1, 0);
    const r = needs(g);
    expect(r?.type === "Target" ? r.fromPlayIds : undefined).toEqual([destroyer(g)!.playId]);
    await target(g, destroyer(g)!.playId);

    expect(destroyer(g)!.damage).toBe(4);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("an enemy unit named by the client is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).Build());
    await g.playCardFromHandAsync(1, 0);
    await target(g, g.state.player2.groundArena[0].playId);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
