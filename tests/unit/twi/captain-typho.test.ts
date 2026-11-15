import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// TWI_046 Captain Typho (2/4): "When Played/On Attack: Give a unit Sentinel for this phase."
describe("TWI_046 Captain Typho", () => {
  it("When Played: a unit gains Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.units.twi.captainTypho).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(HasSentinel(MARINE, g.state.player1.groundArena[0].playId, 1)).toBe(true);
  });
  it("On Attack: the same", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.captainTypho).WithGroundUnitForPlayer(1, MARINE).Build());
    await F.attackBase(g);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    expect(HasSentinel(MARINE, g.state.player1.groundArena[1].playId, 1)).toBe(true);
  });
});
