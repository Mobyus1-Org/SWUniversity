import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_258 Mandalorian Warrior (3/3 Ground, cost 3, Mandalorian) —
//   "When Played: You may give an Experience token to another Mandalorian unit."
//
// Same grant as its two siblings in this batch, restricted by TRAIT rather than by cost — and
// "another", so a lone Warrior has no legal target even though it is itself a Mandalorian.

const WARRIOR = "SHD_258";
const XP = Cards.upgrades.token.experience;
const OTHER_MANDO = "SHD_040";                     // Clan Wren Rescuer — Mandalorian
const NON_MANDO = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, NON_MANDO, 14)
    .WithCardInHandForPlayer(1, WARRIOR)
    .WithActivePlayer(1);
}

const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("SHD_258 Mandalorian Warrior", () => {
  it("gives an Experience token to another Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, OTHER_MANDO).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === OTHER_MANDO);
    await g.chooseGroundUnitAsync(1, idx);

    expect(xpOn(g.state.player1.groundArena[idx])).toBe(1);
  });

  it("does not offer a non-Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, NON_MANDO).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("does not offer itself, even though it is a Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("an ENEMY Mandalorian is a legal target — the text does not say friendly", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, OTHER_MANDO).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, OTHER_MANDO).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === OTHER_MANDO);
    expect(xpOn(g.state.player1.groundArena[idx])).toBe(0);
  });
});
