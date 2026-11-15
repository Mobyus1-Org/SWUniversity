import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, SHIELD, count } = F;
const SABERS = Cards.upgrades.ts26.ahsokasLightsabers; // +2/+3
const DIVERSION = Cards.events.jtl.diversion;          // cost 1 event (Cunning)
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// TS26_35 Ahsoka's Lightsabers: attached unit gains "On Attack/When Defeated: You may give a Shield token to an enemy unit.
// If you do, the next event you play this phase costs 2 resources less."
describe("TS26_35 Ahsoka's Lightsabers", () => {
  it("On Attack: Shield an enemy unit; the next event costs 2 less", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABERS, 1)]).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, DIVERSION).Build());
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(count(g.state.player2.groundArena[0], SHIELD)).toBe(1);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    expect(spent(g)).toBe(0);
  });

  it("declining: no Shield, no discount", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABERS, 1)]).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, DIVERSION).Build());
    await F.attackBase(g, 0);
    await g.chooseNoAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    expect(spent(g)).toBe(1);
  });

  it("When Defeated: the same offer", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE, true, 4).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABERS, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1); // the On Attack offer comes first
    expect(g.state.player1.groundArena).toHaveLength(0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(count(g.state.player2.groundArena[0], SHIELD)).toBe(1);
  });
});
