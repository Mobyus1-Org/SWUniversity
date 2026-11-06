import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// SEC_017 Sabé — Queen's Shadow (Leader, Cunning/Heroism; unit side 3/6 Ground)
//   Front: "When a friendly unit deals combat damage to a base: You may exhaust this leader. If you
//           do, look at the top 2 cards of the defending player's deck. Discard 1 of those cards.
//           (Put the other back on top.)
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Raid 1. When this unit deals combat damage to a base: Look at the defending player's
//           hand. You may discard a card from it. If you do, that player draws a card."

const SABE = Cards.leaders.sec.sabe;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5 Overwhelm
const TURTLE = Cards.units.ash.dinosaurTurtle;
const XWING = Cards.units.sor.allianceXWing;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(SABE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8)
    // P2's deck, bottom → top: XWING, TURTLE, WAMPA (WAMPA is the top card)
    .WithCardInDeckForPlayer(2, XWING)
    .WithCardInDeckForPlayer(2, TURTLE)
    .WithCardInDeckForPlayer(2, WAMPA);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const p2Deck = (g: GameTestAdapter) => g.state.player2.deck.map(c => c.cardId);

async function hitTheBase(g: GameTestAdapter, attackerCardId = MARINE) {
  await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === attackerCardId));
  await g.chooseBaseAsync(1, 2);
}

describe("SEC_017 Sabé — leader side", () => {
  it("may exhaust: look at the top 2, discard one, the other stays on top", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await hitTheBase(g);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(res(g)?.type).toBe("Option"); // which one
    await g.chooseOptionAsync(1, "1");   // the second card: TURTLE

    expect(p2Deck(g)).toEqual([XWING, WAMPA]);
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([TURTLE]);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("discarding the top card leaves the second on top", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await hitTheBase(g);
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "0");

    expect(p2Deck(g)).toEqual([XWING, TURTLE]);
  });

  it("declining keeps Sabé ready and the deck untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await hitTheBase(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(p2Deck(g)).toEqual([XWING, TURTLE, WAMPA]);
  });

  it("Overwhelm excess is combat damage to the base too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, Cards.units.token.battleDroid).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.base.damage).toBe(3);
    expect(res(g)?.type).toBe("Option");
  });

  it("not for an attack on a unit with no spill", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(res(g)).toBeFalsy();
  });
});

describe("SEC_017 Sabé — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }

  it("Raid 1; on combat damage to a base, may discard from the defending hand and they draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, TURTLE).Build());
    await deployed(g);
    const sabe = g.state.player1.groundArena.find(u => u.cardId === SABE)!;
    expect(RaidAmount(SABE, sabe.playId, 1)).toBe(1);

    await hitTheBase(g, SABE);
    expect(g.state.player2.base.damage).toBe(4);
    expect(res(g)?.type).toBe("PeekHand");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [1] }); // the Turtle

    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([TURTLE]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE, WAMPA]); // drew the top card
  });

  it("may discard nothing — then no draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(2, MARINE).Build());
    await deployed(g);

    await hitTheBase(g, SABE);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(p2Deck(g)).toHaveLength(3);
  });

  it("the leader-side exhaust is gone once she is deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await deployed(g);

    await hitTheBase(g);

    expect(res(g)).toBeFalsy();
  });
});
