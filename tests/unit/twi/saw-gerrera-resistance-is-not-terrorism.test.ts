import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, XWING } = F;

// TWI_150 Saw Gerrera (4/8): "Raid 2" / "On Attack: If your base has 15 or more damage on it, deal 1 damage to each enemy ground unit."
describe("TWI_150 Saw Gerrera", () => {
  it("at 15 base damage: 1 to each enemy ground unit, even attacking a base", async () => {
    const state = board().WithGroundUnitForPlayer(1, Cards.units.twi.sawGerreraResistance).WithGroundUnitForPlayer(2, CSF).WithSpaceUnitForPlayer(2, XWING).Build();
    state.player1.base.damage = 15;
    const g = load(state);
    await F.attackBase(g);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
  it("below 15: nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.sawGerreraResistance).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackBase(g);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
