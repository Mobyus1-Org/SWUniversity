import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const TRESPASSER = Cards.units.hmw.miningGuildTrespasser;

// HMW_186 Mining Guild Trespasser: "When Played: You may deal 2 damage to a base and 2 damage to an enemy unit."
describe("HMW_186 Mining Guild Trespasser", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, TRESPASSER).Build());

  it("2 damage to a base and 2 to an enemy unit", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, ["player2.base"]);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.base.damage).toBe(12);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("declining: nothing", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.base.damage).toBe(10);
  });
});
