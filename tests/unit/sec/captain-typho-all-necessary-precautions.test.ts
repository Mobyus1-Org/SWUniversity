import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const TYPHO = Cards.units.sec.captainTypho; // 4/5 Sentinel

// SEC_098 Captain Typho: "When this unit is attacked: You may disclose Command Heroism. If you do, heal 1 damage from your base."
describe("SEC_098 Captain Typho (All Necessary Precautions)", () => {
  it("attacked: disclosing heals 1 from your base", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, TYPHO).WithCardInHandForPlayer(2, MARINE).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(2);
    expect(g.state.player2.base.damage).toBe(9);
    expect(g.state.player2.groundArena[0].damage).toBe(3); // the attack still happens
  });

  it("declining: no heal", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, TYPHO).WithCardInHandForPlayer(2, MARINE).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(2);
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("nothing to disclose: no offer", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, TYPHO).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.base.damage).toBe(10);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
