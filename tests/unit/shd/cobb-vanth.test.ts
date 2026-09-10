import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { DiscardPlayableCards } from "@/server/engine/card-playability";
import { Cards } from "../../card-helpers";

// SHD_115 Cobb Vanth — The Marshal (Unit 3/2 Ground, cost 3, Command)
//   "When Defeated: Search the top 10 cards of your deck for a unit that costs 2 or less and
//    discard it. For this phase, you may play that card from your discard pile for free."

const COBB = Cards.units.shd.cobbVanth;
const MARINE = Cards.units.sor.battlefieldMarine;      // cost 2 unit — eligible
const TIE = Cards.units.sor.tieLnFighter;              // cost 1 unit — eligible
const DURABLE = Cards.units.sor.consularSecurityForce; // cost 4 unit — too expensive
const EVENT = Cards.events.shd.bravado;                // not a unit

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithCardInDeckForPlayer(1, DURABLE)
    .WithCardInDeckForPlayer(1, EVENT)
    .WithCardInDeckForPlayer(1, TIE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, DURABLE); // Cobb (3/2) dies attacking the 3/7
}

type Search = { choices?: { tempId: string; cardId: string }[] };
const searchChoices = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as Search).choices ?? [];

async function cobbDies(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseGroundUnitAsync(2, 0);
}

describe("SHD_115 Cobb Vanth", () => {
  it("searches for a unit costing 2 or less, discards it, and it may be played from the discard for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COBB).Build()); // no resources at all

    await cobbDies(g);
    const pick = searchChoices(g).find(c => c.cardId === MARINE)!;
    await g.chooseDeckSearchAsync(1, [pick.tempId]);

    const inDiscard = g.state.player1.discard.find(c => c.cardId === MARINE)!;
    expect(inDiscard).toBeDefined();
    expect(g.state.player1.deck).toHaveLength(3);
    expect(DiscardPlayableCards(g.state, 1)).toEqual([{ playId: inDiscard.playId, cardId: MARINE, cost: 0 }]);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "play-card", { cardId: MARINE, fromZone: "Discard", playId: inDiscard.playId });
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
  });

  it("offers only UNITS costing 2 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COBB).Build());

    await cobbDies(g);

    expect(searchChoices(g).map(c => c.cardId).sort()).toEqual([MARINE, TIE].sort());
  });

  it("choosing nothing discards nothing and grants nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COBB).Build());

    await cobbDies(g);
    await g.chooseDeckSearchAsync(1, []);

    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([COBB]);
    expect(g.state.player1.deck).toHaveLength(4);
    expect(g.state.roundState.discardPlayGrants).toEqual([]);
  });

  it("only ONE card is discarded, even if more are sent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COBB).Build());

    await cobbDies(g);
    await g.chooseDeckSearchAsync(1, searchChoices(g).map(c => c.tempId));

    expect(g.state.player1.discard.filter(c => c.cardId !== COBB)).toHaveLength(1);
  });

  it("under enemy control, his CONTROLLER searches their own deck and gets the free play", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, COBB).Build();
    state.player1.groundArena[0].owner = 2; // player 1 controls player 2's Cobb
    g.loadNewState(state);

    await cobbDies(g);
    const pick = searchChoices(g).find(c => c.cardId === TIE)!;
    await g.chooseDeckSearchAsync(1, [pick.tempId]);

    expect(g.state.player2.discard.some(c => c.cardId === COBB)).toBe(true); // Cobb goes home
    expect(DiscardPlayableCards(g.state, 1).map(c => c.cardId)).toEqual([TIE]);
  });

  it("the discard counts as 'from your deck' — the ledger records it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COBB).Build());

    await cobbDies(g);
    const pick = searchChoices(g).find(c => c.cardId === MARINE)!;
    await g.chooseDeckSearchAsync(1, [pick.tempId]);

    const inDiscard = g.state.player1.discard.find(c => c.cardId === MARINE)!;
    expect(g.state.roundState.cardsDiscardedThisPhase).toEqual([
      { player: 1, cardId: MARINE, playId: inDiscard.playId, from: "Deck" },
    ]);
  });
});
