import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_053 Pre Vizsla — Strong-Willed Ruler (6/6 Ground, cost 8, Mandalorian, unique) —
//   "When Played: Defeat any number of non-leader units with a total of 6 or less remaining HP.
//    Create a Mandalorian token for each unit defeated this way."
//
// The budget is over REMAINING HP, not printed HP — a damaged 7/7 sitting on 5 damage costs 2 of
// the 6, so a unit far too big to fit "on paper" can be inside the budget. That is the case a
// naive implementation reading CardHp gets wrong.
//
// "Any number of non-leader units" is otherwise unqualified: friendly units are legal, and so is
// Pre Vizsla himself (6/6 = exactly the whole budget). Selecting NOTHING is also legal.

const VIZSLA = "ASH_053";
const MANDO_TOKEN = "ASH_T01";                      // Mandalorian token
const ONE_HP = "SHD_040";                           // Clan Wren Rescuer, 1/2
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const BIG = Cards.units.ash.dinosaurTurtle;         // 7/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, VIZSLA)
    .WithActivePlayer(1);
}

const tokens = (g: GameTestAdapter) =>
  g.state.player1.groundArena.filter(u => u.cardId === MANDO_TOKEN).length;

describe("ASH_053 Pre Vizsla — Strong-Willed Ruler", () => {
  it("defeats two enemy 3/3s (6 total) and creates two Mandalorian tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const ids = g.state.player2.groundArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(tokens(g)).toBe(2);
  });

  it("can defeat FRIENDLY units — 'non-leader units' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const friendly = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendly] });

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);
    expect(tokens(g)).toBe(1);
  });

  it("can defeat HIMSELF — 6/6 is exactly the budget", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    const self = g.state.player1.groundArena.find(u => u.cardId === VIZSLA)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [self] });

    expect(g.state.player1.groundArena.some(u => u.cardId === VIZSLA)).toBe(false);
    expect(tokens(g)).toBe(1);
  });

  it("counts REMAINING HP, so a damaged 7/7 fits inside the budget", async () => {
    // The case a CardHp-based implementation fails: printed 7 is over budget, remaining 2 is not.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, BIG, true, 5).Build()); // 7/7 on 5 damage

    await g.playCardFromHandAsync(1, 0);
    const big = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [big] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(tokens(g)).toBe(1);
  });

  it("rejects a selection over the budget", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)   // 3 + 3 + 3 = 9 > 6
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const ids = g.state.player2.groundArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    expect(g.state.player2.groundArena).toHaveLength(3); // nothing defeated
    expect(tokens(g)).toBe(0);
  });

  it("can be passed — selecting nothing is legal and makes no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(tokens(g)).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("does not offer a LEADER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, ONE_HP).Build());

    await g.playCardFromHandAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    // Only the 1/2 and Pre Vizsla himself; no leader in the list.
    expect(offered).not.toContain("");
    expect(offered.length).toBeGreaterThan(0);
  });

  it("one token per unit, not one per point of HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, ONE_HP)
        .WithGroundUnitForPlayer(2, ONE_HP)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const ids = g.state.player2.groundArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    expect(tokens(g)).toBe(2); // 2 units (4 HP total), 2 tokens
  });
});
