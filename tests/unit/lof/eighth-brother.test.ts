import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, power, hp } = F;
const EIGHTH = Cards.units.lof.eighthBrother;
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_087 Eighth Brother: "When you play another unit: You may use the Force (lose your Force token). If you do,
// give a unit +2/+2 for this phase."
describe("LOF_087 Eighth Brother", () => {
  const setup = () => board().WithGroundUnitForPlayer(1, EIGHTH).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.events.jtl.diversion).Build();
  const marine = (g: ReturnType<typeof load>) => g.state.player1.groundArena.find(u => u.cardId === MARINE)!;

  it("playing another unit: use the Force to give a unit +2/+2", async () => {
    const g = load(withForce(setup()));
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [marine(g).playId]);
    expect([power(marine(g)), hp(marine(g))]).toEqual([5, 5]);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("declining keeps the Force", async () => {
    const g = load(withForce(setup()));
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(power(marine(g))).toBe(3);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("without the Force: no offer", async () => {
    const g = load(setup());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });

  it("playing an event does not trigger it", async () => {
    const g = load(withForce(board().WithGroundUnitForPlayer(1, EIGHTH).WithCardInHandForPlayer(1, Cards.events.jtl.diversion).Build()));
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]); // Diversion's own target
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });
});
