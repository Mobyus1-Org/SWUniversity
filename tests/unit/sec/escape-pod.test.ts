import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;
const POD = Cards.units.sec.escapePod; // 0/3 Space Vehicle

// SEC_056 Escape Pod: "When Played: You may have this unit capture a friendly non-Vehicle, non-leader unit."
describe("SEC_056 Escape Pod", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, POD).Build());
  const pod = (g: ReturnType<typeof setup>) => g.state.player1.spaceArena.find(u => u.cardId === POD)!;

  it("captures a friendly non-Vehicle unit", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(pod(g).captives.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("a Vehicle is refused", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.spaceArena[0].playId]);
    expect(pod(g).captives).toHaveLength(0);
  });

  it("declining captures nothing", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
