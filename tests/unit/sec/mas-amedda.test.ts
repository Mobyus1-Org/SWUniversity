import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XP, count } = F;
const AMEDDA = Cards.units.sec.masAmedda;
const PELLAEON = Cards.units.ash.captainPellaeon; // Official
const RUNE = Cards.units.ic27.runeHaako;          // Official

// SEC_084 Mas Amedda: "When Played: Give an Experience token to each of up to 2 other Official units."
describe("SEC_084 Mas Amedda", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, PELLAEON).WithGroundUnitForPlayer(2, RUNE).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, AMEDDA).Build());

  it("Experience tokens to up to 2 other Officials (either side)", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
    expect(count(g.state.player2.groundArena[0], XP)).toBe(1);
  });

  it("a non-Official is refused", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(count(g.state.player1.groundArena[1], XP)).toBe(0);
  });
});
