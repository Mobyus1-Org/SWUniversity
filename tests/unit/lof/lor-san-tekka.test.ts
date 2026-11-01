import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_095 Lor San Tekka — Secret Keeper (3/2 Ground, cost 2, Command/Heroism, unique) —
//   "When Defeated: You may give an Experience token to a unique unit."
// SOR_108 Vanguard Infantry's ability, narrowed to UNIQUE units (either side).
//
// He attacks a 3/7 Consular Security Force and dies to its counter-damage.

const LOR = Cards.units.lof.lorSanTekka;
const DEFENDER = Cards.units.sor.consularSecurityForce; // 3/7, non-unique
const UNIQUE = Cards.units.lof.gungi;                   // unique, no text
const NON_UNIQUE = Cards.units.hmw.ewokBrigade;         // non-unique, no text
const XP = Cards.upgrades.token.experience;

function board(withUnique: boolean) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithGroundUnitForPlayer(1, LOR)
    .WithGroundUnitForPlayer(1, NON_UNIQUE)
    .WithGroundUnitForPlayer(2, DEFENDER)
    .WithActivePlayer(1);
  if (withUnique) b.WithGroundUnitForPlayer(1, UNIQUE);
  return b;
}

const attackAndDie = async (g: GameTestAdapter) => {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
};
const xpOn = (g: GameTestAdapter, cardId: string) =>
  [...g.state.player1.groundArena, ...g.state.player2.groundArena]
    .find(u => u.cardId === cardId)!.upgrades.filter(u => u.cardId === XP).length;

describe("LOF_095 Lor San Tekka", () => {
  it("When Defeated: gives an Experience token to a chosen unique unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());
    await attackAndDie(g);
    expect(g.state.player1.groundArena.some(u => u.cardId === LOR)).toBe(false);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const uniqueId = g.state.player1.groundArena.find(u => u.cardId === UNIQUE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [uniqueId] });

    expect(xpOn(g, UNIQUE)).toBe(1);
  });

  it("only unique units are offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());
    await attackAndDie(g);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    const uniqueId = g.state.player1.groundArena.find(u => u.cardId === UNIQUE)!.playId;
    const nonUniqueId = g.state.player1.groundArena.find(u => u.cardId === NON_UNIQUE)!.playId;
    expect(res.fromPlayIds).toEqual([uniqueId]);
    expect(res.fromPlayIds).not.toContain(nonUniqueId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.groundArena[0].playId);
  });

  it("may decline — no Experience token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());
    await attackAndDie(g);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(xpOn(g, UNIQUE)).toBe(0);
  });

  it("with no unique unit in play there is no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).Build());
    await attackAndDie(g);

    expect(g.state.player1.groundArena.some(u => u.cardId === LOR)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(xpOn(g, NON_UNIQUE)).toBe(0);
  });
});
