import { describe, it, expect } from "vitest";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, XWING } = F;
const BOBA = Cards.units.jtl.bobaFett;
const GHOST = Cards.units.jtl.theGhost; // Transport
const asPilot = async (g: ReturnType<typeof load>, arena: "space" | "ground" = "space", idx = 0) => {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseOptionAsync(1, "Play as Pilot");
  if (arena === "space") await g.choosePilotVehicleSpaceAsync(1, idx); else await g.choosePilotVehicleGroundAsync(1, idx);
};

// JTL_189 Boba Fett: "When played as an upgrade: You may deal 1 damage to a unit. If attached unit is a
// Transport, you may deal 2 damage instead."
describe("JTL_189 Boba Fett", () => {
  it("as an upgrade: 1 damage to a unit", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, BOBA).Build());
    await asPilot(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("on a Transport: 2 damage", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, GHOST).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, BOBA).Build());
    await asPilot(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("declining deals nothing", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, BOBA).Build());
    await asPilot(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});

describe("JTL_189 Boba Fett — keywords", () => {
  it("has Shielded", () => {
    const g = load(board().WithGroundUnitForPlayer(1, BOBA).Build());
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Shielded", u.playId, 1)).toBe(true);
  });
});
