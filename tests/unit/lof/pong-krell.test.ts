import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const PONG = Cards.units.lof.pongKrell; // 2/9, Grit

// LOF_038 Pong Krell: "When this unit completes an attack (and survives): You may defeat a unit with less
// remaining HP than this unit's power."
describe("LOF_038 Pong Krell", () => {
  const setup = (csfDamage: number) => load(board().WithGroundUnitForPlayer(1, PONG, true, 3).WithGroundUnitForPlayer(2, CSF, true, csfDamage).Build());

  it("defeats a unit with less remaining HP than his power", async () => {
    const g = setup(3); // Pong 5 power (Grit), CSF 4 remaining
    await F.attackBase(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("declining defeats nothing", async () => {
    const g = setup(3);
    await F.attackBase(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("no unit below his power: no offer", async () => {
    const g = setup(2); // 5 remaining = his power, not less
    await F.attackBase(g);
    expect(F.prompt(g)).toBeNull();
  });
});
