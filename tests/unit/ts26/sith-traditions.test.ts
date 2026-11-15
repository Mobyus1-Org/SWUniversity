import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, XP, count } = F;
const TRADITIONS = Cards.upgrades.ts26.sithTraditions; // +1/+1

// TS26_52 Sith Traditions: attached unit gains "On Attack: Give an Experience token to this unit." and "When Defeated:
// Give an Experience token to a friendly unit."
describe("TS26_52 Sith Traditions", () => {
  it("On Attack: an Experience token on itself", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(TRADITIONS, 1)]).Build());
    await F.attackBase(g, 0);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
    expect(g.state.player2.base.damage).toBe(10 + 3 + 1 + 1); // the token lands before damage
  });

  it("When Defeated: an Experience token to a friendly unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE, true, 3).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(TRADITIONS, 1)]).WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === CSF)!.playId]);
    expect(count(g.state.player1.groundArena.find(u => u.cardId === CSF)!, XP)).toBe(1);
  });
});
