import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
const { board, load, MARINE, CSF } = F;
const SISTER = Cards.leaders.lof.thirdSister;
const hidden = (u: { cardId: string; playId: string }) => HasHidden(u.cardId, u.playId, 1);

// LOF_010 Third Sister — Seething With Ambition
//   Front: "Action [Exhaust]: Play a unit from your hand. It gains Hidden for this phase."
//   Deployed: "Hidden" / "On Attack: The next unit you play this phase gains Hidden."
describe("LOF_010 Third Sister — leader Action", () => {
  it("plays a unit from hand; it gains Hidden, others do not", async () => {
    const g = load(board(SISTER).WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, MARINE).Build());
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(marine).toBeDefined();
    expect(hidden(marine)).toBe(true);
    expect(hidden(g.state.player1.groundArena[0])).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(2 + 4); // pays for it (Command and Heroism penalties)
  });

  it("no unit in hand: exhausts and plays nothing", async () => {
    const g = load(board(SISTER).WithCardInHandForPlayer(1, Cards.events.jtl.diversion).Build());
    await g.useLeaderAbilityAsync(1);
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player1.hand).toHaveLength(1);
  });
});

describe("LOF_010 Third Sister — deployed On Attack", () => {
  it("the next unit you play this phase gains Hidden; the one after does not", async () => {
    const g = load(board().MyLeader(SISTER, true, true).WithGroundUnitForPlayer(1, SISTER).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, MARINE).Build());
    await F.attackBase(g, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    const marines = g.state.player1.groundArena.filter(u => u.cardId === MARINE);
    expect(marines.map(hidden)).toEqual([true, false]);
  });
});
