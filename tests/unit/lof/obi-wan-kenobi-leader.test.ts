import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XP, count } = F;
const OBI = Cards.leaders.lof.obiWanKenobi;
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_008 Obi-Wan Kenobi — Courage Makes Heroes
//   Front: "Action [Exhaust, use the Force]: Give an Experience token to a unit without an Experience token on it."
//   Deployed: "On Attack: You may give an Experience token to another unit without an Experience token on it."
describe("LOF_008 Obi-Wan Kenobi — leader Action", () => {
  it("uses the Force to give an Experience token", async () => {
    const g = load(withForce(board(OBI).WithGroundUnitForPlayer(1, MARINE).Build()));
    await g.useLeaderAbilityAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("without the Force it cannot be used", async () => {
    const g = load(board(OBI).WithGroundUnitForPlayer(1, MARINE).Build());
    await g.useLeaderAbilityAsync(1);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("a unit that already has an Experience token is refused", async () => {
    const g = load(withForce(board(OBI).WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(XP, 1)]).WithGroundUnitForPlayer(1, MARINE).Build()));
    await g.useLeaderAbilityAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
  });
});

describe("LOF_008 Obi-Wan Kenobi — deployed On Attack", () => {
  const setup = () => load(board().MyLeader(OBI, true, true).WithGroundUnitForPlayer(1, OBI).WithGroundUnitForPlayer(1, MARINE).Build());

  it("gives another unit an Experience token", async () => {
    const g = setup();
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(count(g.state.player1.groundArena[1], XP)).toBe(1);
  });

  it("not himself", async () => {
    const g = setup();
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });

  it("declining gives nothing", async () => {
    const g = setup();
    await F.attackBase(g, 0);
    await g.chooseNoAsync(1);
    expect(count(g.state.player1.groundArena[1], XP)).toBe(0);
    expect(g.state.player2.base.damage).toBe(10 + 3);
  });
});
