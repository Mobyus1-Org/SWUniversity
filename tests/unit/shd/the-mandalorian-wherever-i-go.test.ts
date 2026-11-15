import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, prompt, count, MARINE, CSF, SHIELD } from "./scan-fixtures";

// SHD_049 The Mandalorian — Wherever I Go, He Goes (5/6 Ground): "Sentinel" / "When Played: You may heal
// all damage from a unit that costs 2 or less and give 2 Shield tokens to it."
describe("SHD_049 The Mandalorian", () => {
  it("heals a cheap unit fully and gives it 2 Shields", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE, true, 2).WithCardInHandForPlayer(1, Cards.units.shd.theMandalorian).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(2);
  });
  it("a 4-cost unit is not offered", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF, true, 2).WithCardInHandForPlayer(1, Cards.units.shd.theMandalorian).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
});
