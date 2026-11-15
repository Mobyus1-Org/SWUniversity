import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const JIH = Cards.units.lof.jediInHiding; // 3/3
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_159 Jedi In Hiding: "When Defeated: You may use the Force. If you do, each opponent discards a card from their hand."
describe("LOF_159 Jedi In Hiding", () => {
  const setup = () => board().WithGroundUnitForPlayer(1, JIH).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(2, MARINE).Build();
  const die = (g: ReturnType<typeof load>) => F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);

  it("When Defeated: using the Force makes the opponent discard", async () => {
    const g = load(withForce(setup()));
    await die(g);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.state.player2.hand).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("declining: no discard", async () => {
    const g = load(withForce(setup()));
    await die(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.hand).toHaveLength(1);
  });

  it("without the Force: no offer", async () => {
    const g = load(setup());
    await die(g);
    expect(F.prompt(g)).toBeNull();
  });
});
