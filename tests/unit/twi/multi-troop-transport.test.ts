import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const DROID = Cards.units.token.battleDroid;    // 1/1 Separatist Droid token

// TWI_066 Multi-Troop Transport (3/6): "Exploit 2" / "On Attack: Create a Battle Droid token."
describe("TWI_066 Multi-Troop Transport", () => {
  it("On Attack: a Battle Droid", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.multiTroopTransport).Build());
    await F.attackBase(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === DROID).length).toBe(1);
  });
});
