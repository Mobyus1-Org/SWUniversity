import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const SIDIOUS = Cards.units.lof.darthSidious;
const KARIS = Cards.units.lof.karis; // 2/4
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_039 Darth Sidious: "When Played: You may use the Force. If you do, defeat each non-Sith unit with 3 or
// less remaining HP."
describe("LOF_039 Darth Sidious (The Phantom Menace)", () => {
  const setup = () => withForce(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, KARIS, true, 1).WithCardInHandForPlayer(1, SIDIOUS).Build());

  it("using the Force defeats every non-Sith unit with 3 or less remaining HP", async () => {
    const g = load(setup());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SIDIOUS]);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CSF]);
  });

  it("declining keeps the Force and defeats nothing", async () => {
    const g = load(setup());
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(3);
  });

  it("without the Force: no offer", async () => {
    const s = setup(); s.player1.supplemental.forceToken = false;
    const g = load(s);
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(3);
  });
});
