import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const CHIRRUT = Cards.units.lof.chirrutImwe; // 3/5, Sentinel
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_067 Chirrut Îmwe: "When this unit is attacked (before damage is dealt): You may use the Force (lose your
// Force token). If you do, the attacker gets –2/–0 for this attack."
describe("LOF_067 Chirrut Îmwe", () => {
  const setup = () => board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CHIRRUT).Build();

  it("using the Force gives the attacker –2/–0", async () => {
    const g = load(withForce(setup(), 2));
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(2);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.supplemental.forceToken).toBe(false);
  });

  it("the –2/–0 lasts only for that attack", async () => {
    const g = load(withForce(setup(), 2));
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(2);
    expect(F.power(g.state.player1.groundArena[0])).toBe(3);
  });

  it("declining: full damage", async () => {
    const g = load(withForce(setup(), 2));
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(2);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.supplemental.forceToken).toBe(true);
  });

  it("without the Force: no offer", async () => {
    const g = load(setup());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
