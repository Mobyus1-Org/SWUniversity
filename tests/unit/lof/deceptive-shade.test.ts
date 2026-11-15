import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE, CSF } = F;
const SHADE = Cards.units.lof.deceptiveShade; // 2/3

// LOF_180 Deceptive Shade: "When Defeated: The next unit you play this phase gains Ambush for this phase."
describe("LOF_180 Deceptive Shade", () => {
  it("the next unit you play gains Ambush; the one after does not", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, SHADE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, MARINE).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena).toHaveLength(0);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    const first = g.state.player1.groundArena[0];
    expect(HasKeyword(first.cardId, "Ambush", first.playId, 1)).toBe(true);
    await g.chooseNoAsync(1); // decline the Ambush attack
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    const second = g.state.player1.groundArena[1];
    expect(HasKeyword(second.cardId, "Ambush", second.playId, 1)).toBe(false);
  });
});
