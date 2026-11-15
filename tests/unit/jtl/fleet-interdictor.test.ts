import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, prompt } = F;
const FLEET = Cards.units.jtl.fleetInterdictor;     // 6/6 Space
const TANTIVE = Cards.units.jtl.tantiveIV;          // 5/7 Space, Sentinel
const PADAWAN = Cards.units.lof.padawanStarfighter; // 1/3 Space, cost 2

// JTL_040 Fleet Interdictor: "When Defeated: You may defeat a space unit that costs 3 or less."
describe("JTL_040 Fleet Interdictor", () => {
  const setup = () => load(board().WithSpaceUnitForPlayer(1, FLEET, true, 5).WithSpaceUnitForPlayer(2, TANTIVE).WithSpaceUnitForPlayer(2, PADAWAN).Build());

  it("When Defeated: defeats a space unit that costs 3 or less", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    expect(g.state.player1.spaceArena).toHaveLength(0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.spaceArena.find(u => u.cardId === PADAWAN)!.playId]);
    expect(g.state.player2.spaceArena.map(u => u.cardId)).toEqual([TANTIVE]);
  });

  it("declining defeats nothing", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    await g.chooseNoAsync(1);
    expect(g.state.player2.spaceArena).toHaveLength(2);
  });

  it("a space unit costing more than 3 is never offered", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, FLEET, true, 5).WithSpaceUnitForPlayer(2, TANTIVE).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    expect(prompt(g)).toBeNull();
  });
});
