import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load } from "./scan-fixtures";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// SHD_204 Millennium Falcon — Lando's Pride (5/5 Space): "If you play this unit from your hand, it gains
// Ambush." / Smuggle
describe("SHD_204 Millennium Falcon", () => {
  it("played from hand: gains Ambush", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.millenniumFalconLandosPride).Build());
    expect(HasAmbush(Cards.units.shd.millenniumFalconLandosPride, g.state.player1.spaceArena[0].playId, "Hand", 1)).toBe(true);
  });
  it("played from anywhere else: no Ambush", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.millenniumFalconLandosPride).Build());
    expect(HasAmbush(Cards.units.shd.millenniumFalconLandosPride, g.state.player1.spaceArena[0].playId, undefined, 1)).toBe(false);
  });
});
