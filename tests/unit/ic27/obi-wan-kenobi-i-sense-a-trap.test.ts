import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_042 Obi-Wan Kenobi — I Sense a Trap (5/9 Ground, cost 8, Vigilance/Heroism)
//   "When Played: You may choose one:
//    • Play a unit that was defeated this phase from your discard pile. It costs 5 resources less.
//    • Choose a unit that entered play this phase. It gets –5/–5 for this phase."

const OBI = Cards.units.ic27.obiWanKenobi;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3, cost 2
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7, cost 4
const HOLDO = Cards.units.ic27.admiralHoldo;             // 3/7, cost 5 — passive text only

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 9)
    .FillResourcesForPlayer(2, MARINE, 9);
}

const optionIds = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Option" ? res.options : [];
};

describe("IC27_042 Obi-Wan Kenobi — replay mode", () => {
  it("replays a friendly unit defeated this phase for 5 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, HOLDO)
      .WithCardInHandForPlayer(1, OBI)
      .Build());
    g.state.player1.groundArena[0].damage = 6; // Security Force dies to Holdo's 3 counter-damage

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(SECURITY);
    await g.dispatchAsync(2, "pass-action", {});
    // 9 resources: Obi-Wan's 8 leaves 1 — the 4-cost unit at 5 less costs 0.
    await g.playCardFromHandAsync(1, 0);
    expect(optionIds(g)).toEqual(["replay", "shrink", "none"]);
    await g.chooseOptionAsync(1, "replay");
    const security = g.state.player1.discard.find(d => d.cardId === SECURITY)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [security] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual(expect.arrayContaining([OBI, SECURITY]));
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(1);
  });

  it("a unit merely discarded (never defeated this phase) is not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, SECURITY).WithCardInHandForPlayer(1, OBI).Build());

    await g.playCardFromHandAsync(1, 0);

    // Only Obi-Wan himself entered play, so the shrink mode is the only one available.
    expect(optionIds(g)).toEqual(["shrink", "none"]);
  });
});

describe("IC27_042 Obi-Wan Kenobi — –5/–5 mode", () => {
  it("offers units that entered play this phase, either side, and shrinks the pick", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithActivePlayer(2)
      .WithGroundUnitForPlayer(2, SECURITY)   // was already in play — not offered
      .WithCardInHandForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, OBI)
      .Build());

    await g.playCardFromHandAsync(2, 0);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "shrink");
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const enemyMarine = g.state.player2.groundArena.find(u => u.cardId === MARINE)!.playId;
    const obi = g.state.player1.groundArena.find(u => u.cardId === OBI)!.playId;
    expect(res?.type === "Target" ? [...(res.fromPlayIds ?? [])].sort() : []).toEqual([enemyMarine, obi].sort());
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarine] });

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([SECURITY]); // 3/3 −5/−5 → defeated
  });

  it("choosing nothing does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithActivePlayer(2)
      .WithCardInHandForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, OBI)
      .Build());

    await g.playCardFromHandAsync(2, 0);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "none");

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
