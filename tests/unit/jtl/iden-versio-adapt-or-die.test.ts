import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XWING, SHIELD } = F;

// JTL_036 Iden Versio — Adapt or Die: Shielded / Piloting / "When this upgrade attaches to a unit: Give a Shield token to that unit."
describe("JTL_036 Iden Versio (piloting)", () => {
  it("played as a Pilot: the Vehicle gets a Shield", async () => {
    const g = load(board(Cards.leaders.sor.idenVersio).WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, Cards.units.jtl.idenVersioAdapt).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    expect(F.count(g.state.player1.spaceArena[0], SHIELD)).toBe(1);
  });
});
