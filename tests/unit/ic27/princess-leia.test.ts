import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_008 Princess Leia — On a Diplomatic Mission (Leader, Cunning/Heroism; unit side 4/7 Ground)
//   Front: "Action [1 resource, Exhaust]: Draw a card, then put a card from your hand on the top or
//           bottom of your deck. Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "On Attack: Draw a card, then put a card from your hand on the top or bottom of your deck."
// Any card in hand may go back, not only the one just drawn.

const LEIA = Cards.leaders.ic27.princessLeia;
const MARINE = Cards.units.sor.battlefieldMarine;
const DRAWN = Cards.units.sor.consularSecurityForce;
const HELD = Cards.units.sor.wampa;

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const deckTop = (g: GameTestAdapter) => g.state.player1.deck[g.state.player1.deck.length - 1]?.cardId;

function board(resources = 14) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(LEIA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, DRAWN)
    .WithCardInHandForPlayer(1, HELD);
}

describe("IC27_008 Princess Leia — leader Action", () => {
  it("pays 1, draws, then puts a chosen hand card on top of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const before = readyResources(g);

    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([HELD, DRAWN]);
    await g.chooseCardFromHandAsync(1, 0); // the card already in hand
    await g.chooseOptionAsync(1, "top");

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([DRAWN]);
    expect(deckTop(g)).toBe(HELD);
    expect(before - readyResources(g)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("can put the card on the bottom instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 1); // the card just drawn
    await g.chooseOptionAsync(1, "bottom");

    expect(g.state.player1.deck[0].cardId).toBe(DRAWN);
    expect(deckTop(g)).toBe(MARINE);
  });

  it("Epic Action needs 6 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBeFalsy();
  });
});

// With an empty deck the draw is the empty-deck penalty (3 damage to your OWN base), and the
// put-back is still mandatory: any card in hand must go onto the (empty) deck.
function emptyDeckBoard() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(LEIA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

describe("IC27_008 Princess Leia — empty deck", () => {
  it("is still usable: 3 damage to your base, and a hand card MUST still go on the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(emptyDeckBoard().WithCardInHandForPlayer(1, HELD).Build());

    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");

    // Can't skip it: choosing nothing is rejected and the prompt stays open (the pick below is
    // only accepted because it is still pending).
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([HELD]);

    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "top");

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([HELD]);
  });

  it("with an empty hand too, it is just the 3 damage — nothing to put back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(emptyDeckBoard().Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("deployed On Attack: same penalty and forced put-back, then the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(emptyDeckBoard().WithCardInHandForPlayer(1, HELD).Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.base.damage).toBe(3);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "bottom");

    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([HELD]);
    expect(g.state.player2.base.damage).toBe(4);
  });
});

describe("IC27_008 Princess Leia — deployed On Attack", () => {
  it("draws, puts a card back, then the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);
    await g.dispatchAsync(2, "pass-action", {});

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([HELD, DRAWN]);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "top");

    expect(deckTop(g)).toBe(HELD);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([DRAWN]);
    expect(g.state.player2.base.damage).toBe(4);
  });
});
