import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_063 Landing Shuttle (Unit 2/4 Space, cost 3, Vigilance)
//   "When Defeated: You may draw a card."

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithSpaceUnitForPlayer(1, Cards.units.jtl.landingShuttle)
    .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer); // 4 power — kills the 2/4
}

async function shuttleDies(g: GameTestAdapter) {
  await g.attackWithSpaceUnitAsync(1, 0);
  await g.chooseSpaceUnitAsync(2, 0);
  expect(g.state.player1.spaceArena).toHaveLength(0);
}

describe("JTL_063 Landing Shuttle", () => {
  it("when defeated, you may draw a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await shuttleDies(g);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
    expect(g.state.player1.deck).toHaveLength(0);
  });

  it("declining draws nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await shuttleDies(g);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
  });
});
