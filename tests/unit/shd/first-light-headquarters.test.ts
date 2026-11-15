import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const HQ = Cards.units.shd.firstLight;           // SHD_036 — Headquarters of the Crimson Dawn
const SEC_FIRST_LIGHT = Cards.units.sec.firstLight; // SEC_088 — Threatening Elegance
const grit = (u: { cardId: string; playId: string }) => HasKeyword(u.cardId, "Grit", u.playId, 1);

// SHD_036 First Light: "Grit. Each other friendly non-leader unit gains Grit." (Its registration was keyed to SEC_088,
// a different First Light, which therefore had Grit and handed it out instead.)
describe("SHD_036 First Light (Headquarters of the Crimson Dawn)", () => {
  it("has Grit, and other friendly non-leader units gain it", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, HQ).WithGroundUnitForPlayer(1, MARINE).Build());
    expect(grit(g.state.player1.spaceArena[0])).toBe(true);
    expect(grit(g.state.player1.groundArena[0])).toBe(true);
  });

  it("SEC_088 First Light grants nothing", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, SEC_FIRST_LIGHT).WithGroundUnitForPlayer(1, MARINE).Build());
    expect(grit(g.state.player1.spaceArena[0])).toBe(false);
    expect(grit(g.state.player1.groundArena[0])).toBe(false);
  });
});
