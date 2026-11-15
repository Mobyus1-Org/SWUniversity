import { describe, it, expect } from "vitest";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XP, count } = F;
const GENERAL = Cards.units.ts26.jediGeneral;
const CLONE = Cards.units.token.cloneTrooper;
/** Plays the General: its When Played first (it and Ambush trigger together), then the Ambush attack declined. */
const playGeneral = async (g: ReturnType<typeof load>) => {
  await F.playFromHand(g);
  await g.chooseOptionAsync(1, "Jedi General — When Played");
  if (F.prompt(g)) await g.chooseNoAsync(1);
};

// TS26_55 Jedi General: "When Played: For each Republic leader you control (as a leader or unit), create a Clone Trooper
// token and give an Experience token to it."
describe("TS26_55 Jedi General", () => {
  it("a Republic leader: one Clone Trooper with an Experience token", async () => {
    const g = load(board(Cards.leaders.lof.obiWanKenobi).WithCardInHandForPlayer(1, GENERAL).Build());
    await playGeneral(g);
    const clones = g.state.player1.groundArena.filter(u => u.cardId === CLONE);
    expect(clones).toHaveLength(1);
    expect(count(clones[0], XP)).toBe(1);
  });

  it("a deployed Republic leader still counts", async () => {
    const OBI = Cards.leaders.lof.obiWanKenobi;
    const g = load(board().MyLeader(OBI, true, true).WithGroundUnitForPlayer(1, OBI).WithCardInHandForPlayer(1, GENERAL).Build());
    await playGeneral(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === CLONE)).toHaveLength(1);
  });

  it("a non-Republic leader: none", async () => {
    const g = load(board().WithCardInHandForPlayer(1, GENERAL).Build());
    await playGeneral(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === CLONE)).toHaveLength(0);
  });
});

describe("TS26_55 Jedi General — keywords", () => {
  it("has Ambush", () => {
    const g = load(board().WithGroundUnitForPlayer(1, GENERAL).Build());
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Ambush", u.playId, 1)).toBe(true);
  });
});
