import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_197 Furtive Handmaiden — "On Attack: You may discard a card from your hand. If you do,
// draw a card." The draw is conditional on the discard actually happening, so declining must
// leave hand, deck and discard untouched.

const MARINE = Cards.units.sor.battlefieldMarine;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithGroundUnitForPlayer(1, Cards.units.sec.furtiveHandmaiden)
    .WithCardInHandForPlayer(1, MARINE)
    .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce)
    .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce);
}

describe("SEC_197 Furtive Handmaiden", () => {
  it("discards a chosen card and draws a replacement when accepted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const handBefore = g.state.player1.hand.length;
    const deckBefore = g.state.player1.deck.length;
    const discardBefore = g.state.player1.discard.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.discard).toHaveLength(discardBefore + 1);
    expect(g.state.player1.deck).toHaveLength(deckBefore - 1);
    expect(g.state.player1.hand).toHaveLength(handBefore); // -1 discarded, +1 drawn
  });

  it("leaves hand, deck and discard untouched when declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const handBefore = g.state.player1.hand.length;
    const deckBefore = g.state.player1.deck.length;
    const discardBefore = g.state.player1.discard.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseNoAsync(1);

    expect(g.state.player1.discard).toHaveLength(discardBefore);
    expect(g.state.player1.deck).toHaveLength(deckBefore);
    expect(g.state.player1.hand).toHaveLength(handBefore);
  });

  it("still resolves the attack — the base takes damage either way", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(2); // Furtive Handmaiden is 2 power
  });

  it("does not prompt with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 10)
        .WithGroundUnitForPlayer(1, Cards.units.sec.furtiveHandmaiden)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );
    const deckBefore = g.state.player1.deck.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.deck).toHaveLength(deckBefore); // no free draw
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does not fire for a unit without the ability (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 1); // the Marine, not the Handmaiden
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(handBefore);
  });
});
