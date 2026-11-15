import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load } = F;
const GUARDIAN = Cards.units.hmw.packGuardian;

// HMW_259 Pack Guardian: "While this unit is ready, it gains Sentinel."
describe("HMW_259 Pack Guardian", () => {
  it("ready: Sentinel", () => {
    const g = load(board().WithGroundUnitForPlayer(1, GUARDIAN).Build());
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Sentinel", u.playId, 1)).toBe(true);
  });

  it("exhausted: no Sentinel", () => {
    const g = load(board().WithGroundUnitForPlayer(1, GUARDIAN, false).Build());
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Sentinel", u.playId, 1)).toBe(false);
  });
});
