import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_232 Kreia's Whispers (Event) — "Draw 3 cards, then put a card from your hand on the top
// of your deck and another card from your hand on the bottom of your deck."
//
// Both placements are mandatory and their destinations are fixed (not a top-or-bottom choice),
// so this is two sequential hand picks. "another card" means the second pick cannot be the
// first one — it has already left the hand.
//
// Deck order convention in this engine: the TOP of the deck is the END of the array (deck.pop()).

const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;
const HIGHSINGER = Cards.units.law.highsinger;

function baseSetup(deckCards: string[] = [CSF, CSF, CSF, CSF]) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, Cards.events.sec.kreiasWhispers);
  for (const c of deckCards) b = b.WithCardInDeckForPlayer(1, c);
  return b;
}

describe("SEC_232 Kreia's Whispers", () => {
  it("draws 3 cards, then banks one to the top and one to the bottom of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    // Drew 3: hand is now 3 (the event itself has left the hand).
    expect(g.state.player1.hand).toHaveLength(3);
    expect(g.state.player1.deck).toHaveLength(deckBefore - 3);

    await g.chooseOptionAsync(1, "0"); // to the top
    await g.chooseOptionAsync(1, "0"); // to the bottom

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.deck).toHaveLength(deckBefore - 1); // -3 drawn, +2 returned
  });

  it("puts the first pick on TOP — it is the next card drawn", async () => {
    const g = new GameTestAdapter();
    // Deck of Consular Security Force; the Highsinger drawn into hand is the marker card.
    g.loadNewState(baseSetup([CSF, CSF, CSF, HIGHSINGER]).Build());

    await g.playCardFromHandAsync(1, 0);
    const topPick = g.state.player1.hand.findIndex(c => c.cardId === HIGHSINGER);
    expect(topPick).toBeGreaterThanOrEqual(0); // Highsinger was drawn

    await g.chooseOptionAsync(1, String(topPick)); // Highsinger to the TOP
    await g.chooseOptionAsync(1, "0");             // something else to the bottom

    expect(g.state.player1.deck[g.state.player1.deck.length - 1].cardId).toBe(HIGHSINGER);
  });

  it("puts the second pick on the BOTTOM of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup([CSF, CSF, CSF, HIGHSINGER]).Build());

    await g.playCardFromHandAsync(1, 0);
    const marker = g.state.player1.hand.findIndex(c => c.cardId === HIGHSINGER);

    await g.chooseOptionAsync(1, marker === 0 ? "1" : "0"); // a non-marker card to the top
    const markerNow = g.state.player1.hand.findIndex(c => c.cardId === HIGHSINGER);
    await g.chooseOptionAsync(1, String(markerNow));        // Highsinger to the BOTTOM

    expect(g.state.player1.deck[0].cardId).toBe(HIGHSINGER);
  });

  it("cannot put the same card in both places — the first pick has left the hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup([CSF, CSF, CSF, HIGHSINGER]).Build());

    await g.playCardFromHandAsync(1, 0);
    const handAfterDraw = g.state.player1.hand.length;

    await g.chooseOptionAsync(1, "0");
    expect(g.state.player1.hand).toHaveLength(handAfterDraw - 1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // second pick still owed

    await g.chooseOptionAsync(1, "0");
    expect(g.state.player1.hand).toHaveLength(handAfterDraw - 2);
  });

  describe("empty deck", () => {
    // A missed draw is not an instant loss in SWU — it deals 3 damage to your OWN base. Three
    // missed draws is 9 self-damage, which can be lethal.
    function emptyDeckSetup(baseDamage: number) {
      return new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, baseDamage)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithCardInHandForPlayer(1, Cards.events.sec.kreiasWhispers)
        .WithCardInHandForPlayer(1, MARINE);
    }

    it("takes 3 damage per missed draw and still resolves when survivable", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(emptyDeckSetup(0).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.base.damage).toBe(9);
      expect(g.state.defeatedPlayers).toEqual([]);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // still banks a card
    });

    it("ends the game immediately when the missed draws are lethal, without prompting", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(emptyDeckSetup(21).Build()); // 21 + 9 = 30 = dead

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.base.damage).toBe(30);
      expect(g.state.defeatedPlayers).toEqual([1]);
      // The player is already dead — they must not be asked to bank cards on a deck they
      // will never draw from again.
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });
  });

  it("draws as many as it can from a short deck and still banks two cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup([CSF]).Build()); // only 1 card to draw

    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.hand).toHaveLength(1);

    await g.chooseOptionAsync(1, "0"); // the lone card to the top

    // Hand is now empty, so the "another card" step has nothing to place and resolves out.
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
