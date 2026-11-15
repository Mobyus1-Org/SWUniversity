import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// TWI_074 Guarding the Way (Event): "Give a unit Sentinel for this phase. If you have the initiative, also give that unit +2/+2 for this phase."
describe("TWI_074 Guarding the Way", () => {
  it("Sentinel, and +2/+2 with the initiative", async () => {
    const g = load(board().WithInitiativePlayerBeing(1).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.events.twi.guardingTheWay).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(HasSentinel(MARINE, g.state.player1.groundArena[0].playId, 1)).toBe(true);
    expect(F.power(g.state.player1.groundArena[0])).toBe(5);
  });
  it("without the initiative, Sentinel only", async () => {
    const g = load(board().WithInitiativePlayerBeing(2).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.events.twi.guardingTheWay).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(F.power(g.state.player1.groundArena[0])).toBe(3);
  });
});
