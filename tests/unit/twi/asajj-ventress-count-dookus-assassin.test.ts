import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const DROID = Cards.units.token.battleDroid;    // 1/1 Separatist Droid token

// TWI_134 Asajj Ventress (2/4): "Exploit 2" / "On Attack: If you've attacked with another Separatist unit this phase, this unit gets +3/+0 for this phase."
describe("TWI_134 Asajj Ventress", () => {
  it("+3/+0 after another Separatist attacked", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, DROID).WithGroundUnitForPlayer(1, Cards.units.twi.asajjVentressAssassin).Build());
    await F.attackBase(g, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackBase(g, 1);
    expect(g.state.player2.base.damage).toBe(10 + 1 + 5);
  });
  it("first attacker: no bonus", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.asajjVentressAssassin).Build());
    await F.attackBase(g);
    expect(g.state.player2.base.damage).toBe(12);
  });
});
