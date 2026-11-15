import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XP, count } = F;
const ADMIRAL = Cards.units.jtl.seasonedFleetAdmiral;
const BRIEFING = Cards.events.sor.missionBriefing; // "Choose a player. They draw 2 cards."

// JTL_111 Seasoned Fleet Admiral: "When an opponent draws 1 or more cards during the action phase: You may
// give an Experience token to a unit."
describe("JTL_111 Seasoned Fleet Admiral", () => {
  const setup = () => {
    let b = board().WithGroundUnitForPlayer(1, ADMIRAL).WithCardInHandForPlayer(1, BRIEFING);
    for (let i = 0; i < 3; i++) b = b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
    return load(b.Build());
  };

  it("the opponent drawing lets you give an Experience token", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // the opponent draws 2
    expect(g.state.player2.hand).toHaveLength(2);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
  });

  it("declining gives nothing", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    await g.chooseNoAsync(1);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });

  it("your own draw does not trigger it", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // you draw 2
    expect(F.prompt(g)).toBeNull();
  });
});
