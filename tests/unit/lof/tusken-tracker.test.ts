import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
const { board, load } = F;
const TRACKER = Cards.units.lof.tuskenTracker;
const JIH = Cards.units.lof.jediInHiding; // Hidden

// LOF_209 Tusken Tracker: "When Played: Each enemy unit loses Hidden for this phase."
describe("LOF_209 Tusken Tracker", () => {
  it("enemy units lose Hidden; your own keep it", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, JIH).WithGroundUnitForPlayer(1, JIH).WithCardInHandForPlayer(1, TRACKER).Build());
    const foe = g.state.player2.groundArena[0], mine = g.state.player1.groundArena[0];
    expect(HasHidden(foe.cardId, foe.playId, 2)).toBe(true);
    await F.playFromHand(g);
    expect(HasHidden(foe.cardId, foe.playId, 2)).toBe(false);
    expect(HasHidden(mine.cardId, mine.playId, 1)).toBe(true);
  });
});
