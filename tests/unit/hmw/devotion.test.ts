import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// HMW_096 Devotion (Upgrade, Vigilance, cost 2, +1/+1, Innate) —
//   "Attached unit gains Restore 2."
// Same text as SOR_070 Devotion. P1's base starts at 5 damage so the Restore heal shows.

const DEVOTION = Cards.upgrades.hmw.devotion;
const HOST = Cards.units.sor.consularSecurityForce; // 3/7, no abilities

function board(withDevotion: boolean) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithGroundUnitForPlayer(1, HOST)
    .WithActivePlayer(1);
  if (withDevotion) b.WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(DEVOTION, 1)]);
  return b;
}

const attackBase = async (g: GameTestAdapter) => {
  await g.attackWithGroundUnitAsync(1, 0);
  if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
};

describe("HMW_096 Devotion", () => {
  it("the attached unit gains Restore 2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());
    const host = g.state.player1.groundArena[0];
    expect(RestoreAmount(host.cardId, host.playId, 1)).toBe(2);
  });

  it("attacking heals 2 from your base and hits for 4 (3 + Devotion's +1)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());
    await attackBase(g);
    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("control: without Devotion the same attack heals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).Build());
    await attackBase(g);
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("can be played from hand onto a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).WithCardInHandForPlayer(1, DEVOTION).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    const host = g.state.player1.groundArena[0];
    expect(host.upgrades.some(u => u.cardId === DEVOTION)).toBe(true);
    expect(RestoreAmount(host.cardId, host.playId, 1)).toBe(2);
  });
});
