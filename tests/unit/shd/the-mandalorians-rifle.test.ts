import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, MARINE, CSF } from "./scan-fixtures";

// SHD_251 The Mandalorian's Rifle (+3/+0, friendly non-Vehicle): "When Played: If attached unit is The
// Mandalorian, he captures an exhausted enemy non-leader unit."
describe("SHD_251 The Mandalorian's Rifle", () => {
  it("on The Mandalorian: captures an exhausted enemy unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.theMandalorian).WithGroundUnitForPlayer(2, MARINE, false).WithCardInHandForPlayer(1, Cards.upgrades.shd.theMandaloriansRifle).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
  });
  it("on anyone else: no capture", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE, false).WithCardInHandForPlayer(1, Cards.upgrades.shd.theMandaloriansRifle).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player2.groundArena.length).toBe(1);
  });
});
