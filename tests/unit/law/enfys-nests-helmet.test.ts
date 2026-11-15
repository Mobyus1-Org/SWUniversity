import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, power } = F;
const HELMET = Cards.upgrades.law.enfysNestsHelmet;

// LAW_186 Enfys Nest's Helmet: attached unit gains "On Attack: You may give another unit +3/+0 for this phase."
describe("LAW_186 Enfys Nest's Helmet", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(HELMET, 1)]).WithGroundUnitForPlayer(1, CSF).Build());

  it("another unit gets +3/+0 for the phase", async () => {
    const g = setup();
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(power(g.state.player1.groundArena[1])).toBe(6);
  });

  it("declining: nothing", async () => {
    const g = setup();
    await F.attackBase(g, 0);
    await g.chooseNoAsync(1);
    expect(power(g.state.player1.groundArena[1])).toBe(3);
  });
});
