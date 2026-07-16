import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_186 Mist Hunter (3/4 Space) —
//   "On Attack: If you played a Bounty Hunter or Pilot card this phase, you may draw a card."
describe("JTL_186 Mist Hunter", () => {
  function base(playedBountyHunter: boolean) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.mistHunter)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
    const state = b.Build();
    if (playedBountyHunter) {
      state.roundState.cardsPlayedThisPhase.push({
        fromPlayer: 1,
        cardId: Cards.units.shd.ruthlessAssassin, // a Bounty Hunter card
        playId: "bh1",
      });
    }
    return state;
  }

  it("draws a card when a Bounty Hunter card was played this phase (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1); // draw

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.deck.length).toBe(0);
  });

  it("may decline the draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1); // skip

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.deck.length).toBe(1);
  });

  it("control: no prompt or draw when no Bounty Hunter/Pilot card was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(false));

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand.length).toBe(0);
  });
});
