import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const DOOKU = Cards.units.lof.dooku; // 5/4 Hidden
const JIH = Cards.units.lof.jediInHiding;

// LOF_211 Dooku: "When Played: Each friendly unit with Hidden can't be attacked for this phase."
describe("LOF_211 Dooku (It Is Too Late)", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, JIH).WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, DOOKU).Build());

  it("a friendly Hidden unit (even one played long ago) can't be attacked", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.attackWithGroundUnitAsync(2, 0);
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("a friendly unit without Hidden can still be attacked", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.attackWithGroundUnitAsync(2, 0);
    await F.pick(g, [g.state.player1.groundArena[1].playId], 2);
    expect(g.state.player1.groundArena[1].damage).toBe(3);
  });

  it("control: without Dooku the old Hidden unit is attackable", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, JIH).WithGroundUnitForPlayer(2, MARINE).WithActivePlayer(2).Build());
    await g.attackWithGroundUnitAsync(2, 0);
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });
});
