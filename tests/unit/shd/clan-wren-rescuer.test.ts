import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_040 Clan Wren Rescuer (1/2 Ground, cost 2, Mandalorian) —
//   "When Played: Give an Experience token to a unit."
//
// Mandatory and unqualified: "a unit" is either side's, and — unlike its two siblings in this
// batch — it does NOT say "another", so the Rescuer can pick itself.

const RESCUER = "SHD_040";
const XP = Cards.upgrades.token.experience;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, RESCUER)
    .WithActivePlayer(1);
}

const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("SHD_040 Clan Wren Rescuer", () => {
  it("gives an Experience token to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, idx);

    expect(xpOn(g.state.player1.groundArena[idx])).toBe(1);
  });

  it("can target an ENEMY unit — 'a unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("can target ITSELF — the text does not say 'another'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === RESCUER);
    await g.chooseGroundUnitAsync(1, idx);

    expect(xpOn(g.state.player1.groundArena[idx])).toBe(1);
  });

  it("the token is a real +1/+1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, idx);

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // 3 + 1
  });
});
