import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;

// TWI_044 Kashyyyk Defender (0/5): "Grit" / "When Played: Heal up to 2 damage from another unit and deal that much damage to this unit."
describe("TWI_044 Kashyyyk Defender", () => {
  it("moves up to 2 damage onto itself", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF, true, 3).WithCardInHandForPlayer(1, Cards.units.twi.kashyyykDefender).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(g.state.player1.groundArena[1].damage).toBe(2);
  });
});
