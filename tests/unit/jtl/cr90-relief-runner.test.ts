import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const CR90 = Cards.units.jtl.cr90ReliefRunner; // 4/6 Space, Restore 2
const TANTIVE = Cards.units.jtl.tantiveIV;     // 5/7

// JTL_071 CR90 Relief Runner: "When Defeated: Heal up to 3 damage from a unit or base."
describe("JTL_071 CR90 Relief Runner", () => {
  const setup = () => load(board().WithSpaceUnitForPlayer(1, CR90, true, 5).WithSpaceUnitForPlayer(2, TANTIVE).WithGroundUnitForPlayer(1, CSF, true, 4).Build());
  const die = (g: ReturnType<typeof setup>) => F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");

  it("When Defeated: heals 3 from a unit", async () => {
    const g = setup();
    await die(g);
    expect(g.state.player1.spaceArena).toHaveLength(0);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("When Defeated: heals 3 from a base", async () => {
    const g = setup();
    await die(g);
    await F.pick(g, ["player1.base"]);
    expect(g.state.player1.base.damage).toBe(10 - 2 - 3); // Restore 2 on the attack, then 3
  });
});
