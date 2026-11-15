import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick } = F;

// TWI_248 Ahsoka's Padawan Lightsaber (+2/+0): "When Played: If attached unit is Ahsoka Tano, you may attack with a unit."
describe("TWI_248 Ahsoka's Padawan Lightsaber", () => {
  it("on Ahsoka: may attack with a unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.ahsokaTanoUnit).WithCardInHandForPlayer(1, Cards.upgrades.twi.ahsokasPadawanLightsaber).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(15);
  });
});
