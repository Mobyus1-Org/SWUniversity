import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const FENNEC = Cards.leaders.ash.fennecShand;
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// ASH_002 Fennec Shand — Ready for War
//   Front: "Action [1 resource, Exhaust, exhaust a friendly unit]: Play a unit from your hand (paying its cost). It enters play ready."
//   Deployed: "Saboteur. Action [1 resource, exhaust a friendly unit]: Play a unit from your hand. It enters play ready."
describe("ASH_002 Fennec Shand — leader Action", () => {
  it("exhaust a friendly unit and pay 1: the unit played enters ready", async () => {
    const g = load(board(FENNEC).WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, MARINE).Build());
    await g.useLeaderAbilityAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseCardFromHandAsync(1, 0);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(marine.ready).toBe(true);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(spent(g)).toBe(1 + 2 + 4); // the Action's 1, the Marine's 2 and its Command/Heroism penalty
  });

  it("no ready friendly unit: can't be used", async () => {
    const g = load(board(FENNEC).WithGroundUnitForPlayer(1, CSF, false).WithCardInHandForPlayer(1, MARINE).Build());
    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("ASH_002 Fennec Shand — deployed Action", () => {
  it("she doesn't exhaust herself; the friendly unit is the cost", async () => {
    const g = load(board().MyLeader(FENNEC, true, true).WithGroundUnitForPlayer(1, FENNEC).WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, MARINE).Build());
    await g.dispatchAsync(1, "use-ability", { cardId: FENNEC, playId: g.state.player1.groundArena[0].playId });
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena[0].ready).toBe(true);  // Fennec
    expect(g.state.player1.groundArena[1].ready).toBe(false); // the CSF paid the cost
    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(true);
  });
});
