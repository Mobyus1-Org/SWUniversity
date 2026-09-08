import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_244 No Bargain (Event, cost 3, Villainy, Trick) —
//   "Each opponent discards a card from their hand. Draw a card."
//
// The OPPONENT picks which card — it is not a random discard — so this raises a prompt owned by
// the other player. The draw belongs to the caster and happens after.

const NO_BARGAIN = "SHD_244";
const MARINE = Cards.units.sor.battlefieldMarine;
const OTHER = "IBH_008";

function setup() {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, NO_BARGAIN)
    .WithActivePlayer(1);
  for (let i = 0; i < 3; i++) b = b.WithCardInDeckForPlayer(1, MARINE);
  return b;
}

describe("SHD_244 No Bargain", () => {
  it("makes the opponent discard a card of their choosing, and draws one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, OTHER)
        .Build(),
    );
    const myHandBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-target", { targetIndices: [1] }); // opponent picks

    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(OTHER);
    expect(g.state.player1.hand.length).toBe(myHandBefore - 1 + 1); // event out, one drawn
  });

  it("the discard is the OPPONENT's choice, not the caster's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, OTHER)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-target", { targetIndices: [0] }); // the other one

    expect(g.state.player2.discard.map(c => c.cardId)).toContain(MARINE);
  });

  it("still draws when the opponent's hand is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const myHandBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(myHandBefore - 1 + 1);
  });
});
