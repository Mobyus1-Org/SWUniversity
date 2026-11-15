import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, prompt, MARINE, CSF } from "./scan-fixtures";

// SHD_217 Tobias Beckett — I Trust No One (4/5 Ground): "When you play a non-unit card: You may exhaust a
// unit that costs the same as or less than the card you played. Use this ability only once each round."
const EVENT = Cards.events.hmw.migrate; // cost 3
describe("SHD_217 Tobias Beckett", () => {
  it("playing a 3-cost event: may exhaust a unit costing 3 or less", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.tobiasBeckett).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, EVENT).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
  it("once each round", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.tobiasBeckett).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, EVENT).WithCardInHandForPlayer(1, EVENT).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
  it("playing a unit does nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.tobiasBeckett).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, MARINE).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
});
