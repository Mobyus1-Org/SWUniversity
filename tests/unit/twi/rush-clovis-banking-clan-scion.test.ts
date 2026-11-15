import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const DROID = Cards.units.token.battleDroid;    // 1/1 Separatist Droid token

// TWI_183 Rush Clovis (3/5): "Raid 2" / "On Attack: If the defending player controls no ready resources, create a Battle Droid token."
describe("TWI_183 Rush Clovis", () => {
  it("defender with no ready resources: a Battle Droid", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.rushClovisScion).Build());
    await F.attackBase(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === DROID).length).toBe(1);
  });
  it("defender with a ready resource: nothing", async () => {
    const g = load(board().FillResourcesForPlayer(2, MARINE, 1).WithGroundUnitForPlayer(1, Cards.units.twi.rushClovisScion).Build());
    await F.attackBase(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === DROID).length).toBe(0);
  });
});
