import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const SABER = Cards.upgrades.lof.inquisitorsLightsaber; // +1/+3
const CHIRRUT = Cards.units.lof.chirrutImwe;            // 3/5 Force

// LOF_090 Inquisitor's Lightsaber — attached unit gains "While attacking a Force unit, this unit gets +2/+0."
describe("LOF_090 Inquisitor's Lightsaber", () => {
  it("+2/+0 while attacking a Force unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).WithGroundUnitForPlayer(2, CHIRRUT).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena).toHaveLength(0); // 3 + 1 + 2 = 6 into 5 HP
  });

  it("no bonus against a non-Force unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });
});
