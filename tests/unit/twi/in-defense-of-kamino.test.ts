import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// TWI_129 In Defense of Kamino (Event): "For this phase, each friendly Republic unit gains Restore 2 and: 'When Defeated: Create a Clone Trooper token.'"
describe("TWI_129 In Defense of Kamino", () => {
  it("Republic units gain Restore 2 and a Clone Trooper When Defeated", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.events.twi.inDefenseOfKamino).Build());
    await g.playCardFromHandAsync(1, 0);
    const clone = g.state.player1.groundArena[0];
    expect(RestoreAmount(CLONE, clone.playId, 1)).toBe(2);
    expect(RestoreAmount(MARINE, g.state.player1.groundArena[1].playId, 1)).toBe(0); // not Republic
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId); // the 2/2 Clone dies to the 3/7
    expect(g.state.player1.groundArena.filter(u => u.cardId === CLONE).length).toBe(1); // a fresh one
  });
});
