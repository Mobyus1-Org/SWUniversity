import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const BOTHAN = Cards.units.ash.bothan5;            // 4/5 Space
const PADAWAN = Cards.units.lof.padawanStarfighter; // a Vehicle

// ASH_128 Bothan-5: "When another friendly non-Vehicle unit is defeated: You may have this unit capture that unit from your
// discard pile. Use this ability only once each round."
describe("ASH_128 Bothan-5", () => {
  it("captures the defeated friendly unit from your discard pile", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, BOTHAN).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    expect(g.state.player1.spaceArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.discard).toHaveLength(0);
  });

  it("only once each round", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, BOTHAN).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackUnit(g, 0, g.state.player2.groundArena[1].playId);
    expect(F.prompt(g)).toBeNull();
  });

  it("a Vehicle being defeated: no offer", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, BOTHAN).WithSpaceUnitForPlayer(1, PADAWAN).WithSpaceUnitForPlayer(2, Cards.units.jtl.tantiveIV).Build());
    await F.attackUnit(g, 1, g.state.player2.spaceArena[0].playId, "space");
    expect(F.prompt(g)).toBeNull();
  });
});
