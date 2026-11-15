import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const MANDO = Cards.units.sec.theMandalorian; // 6/8

// SEC_209 The Mandalorian: "When this unit attacks and defeats a unit: You may choose an enemy non-leader unit. This
// unit captures it."
describe("SEC_209 The Mandalorian (Cleaning Up Nevarro)", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MANDO).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).Build());

  it("defeating a unit: he captures another enemy unit", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([CSF]);
  });

  it("declining captures nothing", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("not defeating the defender: no offer", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[1].playId);
    expect(F.prompt(g)).toBeNull();
  });
});
