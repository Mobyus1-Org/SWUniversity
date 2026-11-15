import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const SAVAGE = Cards.units.lof.savageOpress; // 9/6
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_137 Savage Opress: "When Played/When Defeated: You may use the Force (lose your Force token). If you don't,
// deal 9 damage to your base."
describe("LOF_137 Savage Opress", () => {
  const hand = () => board().WithCardInHandForPlayer(1, SAVAGE).Build();

  it("When Played: using the Force spares your base", async () => {
    const g = load(withForce(hand()));
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    expect(g.state.player1.base.damage).toBe(10);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("When Played: declining deals 9 to your base", async () => {
    const g = load(withForce(hand()));
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.base.damage).toBe(19);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("When Played: no Force — 9 to your base, no question", async () => {
    const g = load(hand());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player1.base.damage).toBe(19);
  });

  it("When Defeated: the same", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, SAVAGE, true, 5).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(19);
  });
});
