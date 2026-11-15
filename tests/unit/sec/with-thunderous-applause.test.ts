import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, power, hp } = F;
const APPLAUSE = Cards.events.sec.withThunderousApplause; // cost 3, Command
const DIVERSION = Cards.events.jtl.diversion;            // Cunning — can't disclose Command

// SEC_129 With Thunderous Applause: "Give a unit +2/+2 for this phase. You may disclose Command (reveal a card
// from your hand with this aspect icon). If you do, give another unit +2/+2 for this phase."
describe("SEC_129 With Thunderous Applause", () => {
  const setup = (...hand: string[]) => {
    let b = board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, APPLAUSE);
    for (const c of hand) b = b.WithCardInHandForPlayer(1, c);
    return load(b.Build());
  };
  const stats = (u: Parameters<typeof power>[0]) => [power(u), hp(u)];
  const handIndexOf = (g: ReturnType<typeof setup>, id: string) => g.state.player1.hand.findIndex(c => c.cardId === id);

  it("+2/+2 on a unit; disclosing Command gives another unit +2/+2", async () => {
    const g = setup(MARINE);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, handIndexOf(g, MARINE));
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(stats(g.state.player1.groundArena[0])).toEqual([5, 5]);
    expect(stats(g.state.player1.groundArena[1])).toEqual([5, 9]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]); // disclosing only reveals
  });

  it("the second unit must be a different one", async () => {
    const g = setup(MARINE);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, handIndexOf(g, MARINE));
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(power(g.state.player1.groundArena[0])).toBe(5);
  });

  it("a non-Command card cannot be disclosed", async () => {
    const g = setup(DIVERSION, MARINE);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, handIndexOf(g, DIVERSION));
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("skipping the disclose: only the first unit", async () => {
    const g = setup(MARINE);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseNoAsync(1);
    expect(power(g.state.player1.groundArena[0])).toBe(5);
    expect(power(g.state.player1.groundArena[1])).toBe(3);
  });

  it("no Command card in hand: no disclose offer", async () => {
    const g = setup(DIVERSION);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(F.prompt(g)).toBeNull();
    expect(power(g.state.player1.groundArena[0])).toBe(5);
  });

  it("no other unit in play: no disclose offer", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, APPLAUSE).WithCardInHandForPlayer(1, MARINE).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(F.prompt(g)).toBeNull();
  });

  it("the bonus lasts for this phase only", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    expect(power(g.state.player1.groundArena[0])).toBe(3);
  });
});
