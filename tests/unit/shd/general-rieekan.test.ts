import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, count, MARINE, XP } from "./scan-fixtures";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SHD_103 General Rieekan — Defensive Strategist (5/7 Ground): "When Played/On Attack: Choose a friendly
// unit. If it has Sentinel, give an Experience token to it. Otherwise, it gains Sentinel for this phase."
describe("SHD_103 General Rieekan", () => {
  it("When Played on a Sentinel unit: an Experience token", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.clanSaxonGauntlet).WithCardInHandForPlayer(1, Cards.units.shd.generalRieekan).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.spaceArena[0].playId]);
    expect(count(g.state.player1.spaceArena[0], XP)).toBe(1);
  });
  it("On Attack on a unit without Sentinel: it gains Sentinel for this phase", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.generalRieekan).WithGroundUnitForPlayer(1, MARINE).Build());
    const marine = g.state.player1.groundArena[1].playId;
    expect(HasSentinel(MARINE, marine, 1)).toBeFalsy();
    await attackBase(g);
    await pick(g, [marine]);
    expect(HasSentinel(MARINE, marine, 1)).toBe(true);
    expect(count(g.state.player1.groundArena[1], XP)).toBe(0);
  });
});
