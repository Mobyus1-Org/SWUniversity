import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const NEXU = Cards.units.hmw.arenaNexu; // 2/6, Grit, Creature

// HMW_182 Arena Nexu: "Grit. On Attack: You may deal 3 damage to a friendly Creature unit (including this one) and ready
// this unit. Use this ability only once each round."
describe("HMW_182 Arena Nexu", () => {
  it("3 damage to itself: hits harder (Grit) and is ready after the attack", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, NEXU).Build());
    await F.attackBase(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player2.base.damage).toBe(10 + 2 + 3);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("only once each round", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, NEXU).Build());
    await F.attackBase(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackBase(g);
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("declining: exhausted as usual", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, NEXU).Build());
    await F.attackBase(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
