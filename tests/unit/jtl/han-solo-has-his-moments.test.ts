import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XWING } = F;
const HAN = Cards.units.jtl.hanSolo;                      // as a pilot +2/+3
const FALCON = Cards.units.sor.millenniumFalconSor;       // 3/4 Space, "Millennium Falcon"
const EXECUTOR = Cards.units.jtl.executor;                // 12/12
const asPilot = async (g: ReturnType<typeof load>, arena: "space" | "ground" = "space", idx = 0) => {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseOptionAsync(1, "Play as Pilot");
  if (arena === "space") await g.choosePilotVehicleSpaceAsync(1, idx); else await g.choosePilotVehicleGroundAsync(1, idx);
};

// JTL_203 Han Solo: "When played as an upgrade: You may attack with attached unit. If it's the Millennium
// Falcon, it deals its combat damage before the defender."
describe("JTL_203 Han Solo", () => {
  it("as an upgrade: the Vehicle attacks", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, HAN).Build());
    await asPilot(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.spaceArena[0].playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(10 + 2 + 2);
  });

  it("the Millennium Falcon deals its damage first", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, FALCON).WithSpaceUnitForPlayer(2, EXECUTOR, true, 7).WithCardInHandForPlayer(1, HAN).Build());
    await asPilot(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.spaceArena[0].playId]);
    await F.pick(g, [g.state.player2.spaceArena[0].playId]);
    expect(g.state.player2.spaceArena.some(u => u.cardId === EXECUTOR)).toBe(false);
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
  });

  it("control: another Vehicle takes the defender's damage", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithSpaceUnitForPlayer(2, F.XWING).WithCardInHandForPlayer(1, HAN).Build());
    await asPilot(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.spaceArena[0].playId]);
    await F.pick(g, [g.state.player2.spaceArena[0].playId]);
    expect(g.state.player1.spaceArena[0].damage).toBe(2);
  });

  it("declining: no attack", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, HAN).Build());
    await asPilot(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.base.damage).toBe(10);
    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });
});
