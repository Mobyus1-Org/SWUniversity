import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const REPEATER = Cards.upgrades.law.staccatoLightningRepeater;

// LAW_187 "Staccato Lightning" Repeater: "When Played: Deal 1 damage to each of up to 3 different ground units."
describe("LAW_187 \"Staccato Lightning\" Repeater", () => {
  it("1 damage to each of up to 3 ground units", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, REPEATER).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await F.pick(g, g.state.player2.groundArena.slice(0, 3).map(u => u.playId));
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([1, 1, 1]);
  });

  it("no more than 3", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, REPEATER).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await F.pick(g, [g.state.player1.groundArena[1].playId, ...g.state.player2.groundArena.map(u => u.playId)]);
    expect(g.state.player2.groundArena.every(u => u.damage === 0)).toBe(true);
  });
});
