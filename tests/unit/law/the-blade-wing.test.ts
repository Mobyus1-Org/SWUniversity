import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_241 The Blade Wing — The Secret of Shantipole (3/3 Space, cost 6, Cunning, unique) —
//   "When Played: You may return a non-leader unit to its owner's hand."
// Same text as SOR_202 Cantina Bouncer.

const BLADE_WING = Cards.units.law.theBladeWing;
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.hanSolo)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin, true, true)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, BLADE_WING)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithGroundUnitForPlayer(2, Cards.leaders.sor.grandMoffTarkin) // deployed leader unit
    .WithActivePlayer(1);
}

describe("LAW_241 The Blade Wing", () => {
  it("returns a chosen non-leader unit to its owner's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const marineId = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marineId] });

    expect(g.state.player2.groundArena.some(u => u.playId === marineId)).toBe(false);
    expect(g.state.player2.hand.some(c => c.cardId === MARINE)).toBe(true);
  });

  it("does not offer a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const marineId = g.state.player2.groundArena[0].playId;
    const leaderId = g.state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(marineId);
    expect(res.fromPlayIds).not.toContain(leaderId);
  });

  it("may decline — nothing is returned", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(2);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});
