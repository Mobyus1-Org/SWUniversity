import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const TECH = Cards.units.hmw.tech; // 3/5

// HMW_211 Tech: "When this unit is dealt damage and survives: You may exhaust a unit."
describe("HMW_211 Tech", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, TECH).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).Build());

  it("damaged and survives: may exhaust a unit", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    const csf = g.state.player2.groundArena.find(u => u.cardId === CSF)!;
    await F.pick(g, [csf.playId]);
    expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.ready).toBe(false);
  });

  it("declining", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.ready).toBe(true);
  });
});
