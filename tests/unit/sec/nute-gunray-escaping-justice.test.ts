import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const NUTE = Cards.units.sec.nuteGunray;                  // 3/4, Official
const PELLAEON = Cards.units.ash.captainPellaeon;         // Official
const sentinel = (u: { cardId: string; playId: string }) => HasKeyword(u.cardId, "Sentinel", u.playId, 1);

// SEC_031 Nute Gunray: "When Played/On Attack: You may give another friendly Official unit Sentinel for this phase."
describe("SEC_031 Nute Gunray", () => {
  it("When Played: another friendly Official gains Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, PELLAEON).WithCardInHandForPlayer(1, NUTE).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(sentinel(g.state.player1.groundArena[0])).toBe(true);
  });

  it("On Attack: the same", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, NUTE).WithGroundUnitForPlayer(1, PELLAEON).Build());
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(sentinel(g.state.player1.groundArena[1])).toBe(true);
  });

  it("a non-Official is not offered", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, NUTE).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });
});
