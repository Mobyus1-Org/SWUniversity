import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE, CSF } = F;

// TWI_256 Hold-Out Blaster (+1/+0): "When Played: You may have attached unit deal 1 damage to a ground unit."
describe("TWI_256 Hold-Out Blaster", () => {
  it("the host deals 1 to a ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.upgrades.twi.holdOutBlaster).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });
});
