import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const KAADU = Cards.units.lof.kaadu;

// LOF_114 Kaadu: "When Played: You may give another friendly unit Overwhelm for this phase."
describe("LOF_114 Kaadu", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE, true, 2).WithCardInHandForPlayer(1, KAADU).Build());

  it("the chosen unit gains Overwhelm for the phase", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.base.damage).toBe(10 + 2);
  });

  it("not Kaadu itself", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    const kaadu = g.state.player1.groundArena.find(u => u.cardId === KAADU)!;
    await F.pick(g, [kaadu.playId]);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("declining: no Overwhelm", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.base.damage).toBe(10);
  });
});
