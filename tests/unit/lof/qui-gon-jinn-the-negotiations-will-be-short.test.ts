import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const QUIGON = Cards.units.lof.quiGonJinn; // 7/5

// LOF_200 Qui-Gon Jinn: "When Defeated: You may choose a non-leader ground unit. Its owner puts it on the top or bottom of
// their deck."
describe("LOF_200 Qui-Gon Jinn (The Negotiations Will Be Short)", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, QUIGON, true, 4).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInDeckForPlayer(2, MARINE).Build());
  const die = (g: ReturnType<typeof setup>) => F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);

  it("the owner puts it on top of their deck", async () => {
    const g = setup();
    await die(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await g.chooseOptionAsync(2, "top");
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.deck.map(c => c.cardId)).toEqual([MARINE, CSF]);
  });

  it("…or on the bottom", async () => {
    const g = setup();
    await die(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await g.chooseOptionAsync(2, "bottom");
    expect(g.state.player2.deck.map(c => c.cardId)).toEqual([CSF, MARINE]);
  });

  it("declining", async () => {
    const g = setup();
    await die(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
