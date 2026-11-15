import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;
const BOSHEK = Cards.units.jtl.boshek;
const LEIA = Cards.units.jtl.leiaOrgana; // cost 3 (odd)
const asPilot = async (g: ReturnType<typeof load>, arena: "space" | "ground" = "space", idx = 0) => {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseOptionAsync(1, "Play as Pilot");
  if (arena === "space") await g.choosePilotVehicleSpaceAsync(1, idx); else await g.choosePilotVehicleGroundAsync(1, idx);
};

// JTL_215 BoShek: "When played as an upgrade: Discard 2 cards from your deck. Return each of those cards with
// an odd cost to your hand."
describe("JTL_215 BoShek", () => {
  it("as an upgrade: mills 2, returns the odd-cost one", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, BOSHEK)
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, LEIA).WithCardInDeckForPlayer(1, MARINE).Build()); // top = end of the array
    await asPilot(g);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([LEIA]);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("as a unit: nothing is milled", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, BOSHEK).WithCardInDeckForPlayer(1, LEIA).WithCardInDeckForPlayer(1, MARINE).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit");
    expect(g.state.player1.deck).toHaveLength(2);
  });
});
