import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const MOORE = Cards.units.sec.slyMoore;

// SEC_033 Sly Moore: "When Played: For this phase, each enemy unit gets –2/–0 while it's attacking a base."
describe("SEC_033 Sly Moore (Witness to Power)", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, MOORE).Build());

  it("an enemy unit attacking your base gets –2/–0", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);
    expect(g.state.player1.base.damage).toBe(10 + 1);
  });

  it("attacking a unit: full power", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.attackWithGroundUnitAsync(2, 0);
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
