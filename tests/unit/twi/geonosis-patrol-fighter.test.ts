import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE, CSF } = F;

// TWI_215 Geonosis Patrol Fighter (3/2 Space): "Exploit 2" / "When Played: You may return a non-leader unit that costs 3 or less to its owner's hand."
describe("TWI_215 Geonosis Patrol Fighter", () => {
  it("returns a unit costing 3 or less; a 4-cost isn't offered", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.twi.geonosisPatrolFighter).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
  });
});
