import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, power, hp } = F;
const PADAWAN = Cards.units.lof.padawanStarfighter; // 1/3
const KARIS = Cards.units.lof.karis;
const SIZE = Cards.upgrades.lof.sizeMattersNot;     // Force upgrade

// LOF_060 Padawan Starfighter: "While you control a Force unit or upgrade, this unit gets +1/+1."
describe("LOF_060 Padawan Starfighter", () => {
  it("+1/+1 with a friendly Force unit", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, PADAWAN).WithGroundUnitForPlayer(1, KARIS).Build());
    expect([power(g.state.player1.spaceArena[0]), hp(g.state.player1.spaceArena[0])]).toEqual([2, 4]);
  });

  it("+1/+1 with a friendly Force upgrade", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, PADAWAN).WithGroundUnitForPlayer(1, F.MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SIZE, 1)]).Build());
    expect(power(g.state.player1.spaceArena[0])).toBe(2);
  });

  it("an enemy Force unit does not count", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, PADAWAN).WithGroundUnitForPlayer(2, KARIS).Build());
    expect([power(g.state.player1.spaceArena[0]), hp(g.state.player1.spaceArena[0])]).toEqual([1, 3]);
  });
});
