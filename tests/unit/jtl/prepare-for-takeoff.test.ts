import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_128 Prepare for Takeoff — Event (Command), cost 2
// "Search the top 8 cards of your deck for up to 2 Vehicle units, reveal them, and draw them."
// Same text as SOR_125.

const PFT = Cards.events.jtl.prepareForTakeoff;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, PFT)
    .WithActivePlayer(1)
    .Build();
}

describe("JTL_128 Prepare for Takeoff", () => {
  it("offers a deck search when the deck has Vehicle units", async () => {
    const g = new GameTestAdapter();
    const state = board();
    g.loadNewState(state);
    state.player1.deck = [
      { cardId: Cards.units.sor.reinforcementWalker },
      { cardId: Cards.units.sor.blizzardAssaultAtAt },
    ];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DeckSearch");
  });

  it("draws the chosen Vehicle units; a non-Vehicle is not offered", async () => {
    const g = new GameTestAdapter();
    const state = board();
    g.loadNewState(state);
    state.player1.deck = [
      { cardId: Cards.units.sor.reinforcementWalker },
      { cardId: Cards.units.sor.battlefieldMarine }, // not a Vehicle
      { cardId: Cards.units.sor.blizzardAssaultAtAt },
    ];

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DeckSearch");
    await g.chooseDeckSearchAsync(1, ["0", "2"]);

    const hand = g.state.player1.hand.map(c => c.cardId);
    expect(hand).toContain(Cards.units.sor.reinforcementWalker);
    expect(hand).toContain(Cards.units.sor.blizzardAssaultAtAt);
    expect(hand).not.toContain(Cards.units.sor.battlefieldMarine);
  });

  it("may choose nothing", async () => {
    const g = new GameTestAdapter();
    const state = board();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.reinforcementWalker }];

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DeckSearch");
    await g.chooseDeckSearchAsync(1, []);

    expect(g.state.player1.hand.map(c => c.cardId)).not.toContain(Cards.units.sor.reinforcementWalker);
    expect(g.state.player1.deck).toHaveLength(1);
  });
});
