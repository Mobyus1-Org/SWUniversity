import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const MON = Cards.units.sec.monMothma;
const TURTLE = Cards.units.ash.dinosaurTurtle; // 7/7

// SEC_103 Mon Mothma: "When Played: You may attack with any number of other units (one at a time), even if those units
// are exhausted. They can't attack bases for these attacks."
describe("SEC_103 Mon Mothma (Clinging to Hope)", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MARINE, false).WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, TURTLE).WithCardInHandForPlayer(1, MON).Build());
  const turtle = (g: ReturnType<typeof setup>) => g.state.player2.groundArena[0];

  it("attacks with each other unit in turn, exhausted ones included", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]); // the exhausted Marine
    await F.pick(g, [turtle(g).playId]);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === CSF)!.playId]);
    await F.pick(g, [turtle(g).playId]);
    expect(turtle(g).damage).toBe(6);
    expect(F.prompt(g)).toBeNull(); // nobody left (Mon herself never attacks this way)
  });

  it("they can't attack a base", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === CSF)!.playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("may stop after any attack", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === CSF)!.playId]);
    await F.pick(g, [turtle(g).playId]);
    await g.chooseNoAsync(1);
    expect(turtle(g).damage).toBe(3);
  });

  it("declining: no attacks", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(turtle(g).damage).toBe(0);
  });
});
