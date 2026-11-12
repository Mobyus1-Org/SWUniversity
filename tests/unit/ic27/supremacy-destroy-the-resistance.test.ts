import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_110 Supremacy — Destroy the Resistance (10/10 Space, cost 10, Aggression/Villainy)
//   "When Played: Deal damage to a base equal to half its remaining HP, rounded down."

const SUPREMACY = Cards.units.ic27.supremacy;

function board(theirBase: string, theirDamage: number, myDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP, myDamage)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(theirBase, theirDamage)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, SUPREMACY);
}

async function playAndPick(g: GameTestAdapter, basePlayer: 1 | 2) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseBaseAsync(1, basePlayer); // the UI shape: targetZones Base + targetPlayers
}

describe("IC27_110 Supremacy", () => {
  it("an undamaged 30-HP base takes 15", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.bases.common.green30HP, 0).Build());
    await playAndPick(g, 2);
    expect(g.state.player2.base.damage).toBe(15);
  });

  it("odd remaining HP rounds down: 27 → 13", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.bases.common.green30HP, 3).Build());
    await playAndPick(g, 2);
    expect(g.state.player2.base.damage).toBe(16);
  });

  it("1 remaining HP deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.bases.common.green30HP, 29).Build());
    await playAndPick(g, 2);
    expect(g.state.player2.base.damage).toBe(29);
  });

  it("reads the base's real HP — a 28-HP base takes 14", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.bases.common.green28HPForce, 0).Build());
    await playAndPick(g, 2);
    expect(g.state.player2.base.damage).toBe(14);
  });

  it("'a base' includes your own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.bases.common.green30HP, 0, 4).Build());
    await playAndPick(g, 1);
    expect(g.state.player1.base.damage).toBe(17); // 26 remaining → 13
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the raw playId shape works too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.bases.common.green30HP, 0).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });
    expect(g.state.player2.base.damage).toBe(15);
  });
});
