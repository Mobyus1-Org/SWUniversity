import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";

// HMW_056 Yoda — Trickster in Exile (4/4 Ground, cost 3, Cunning/Vigilance/Heroism, Force Fringe
// Jedi, unique)
//   Hidden
//   When Defeated: You may put this card from your discard pile on top of your deck. If you do,
//   heal 2 damage from a base.
//
// Yoda is defeated with P1's own Vanquish, so the When Defeated is P1's to answer. Both bases
// start at 10 damage so the heal shows on whichever is picked. Deck TOP is the END of the array.
const YODA = Cards.units.hmw.yodaTrickster;
const VANQUISH = Cards.events.sor.vanquish;
const DECK_FILLER = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP, 10)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, DECK_FILLER, 14)
    .FillResourcesForPlayer(2, DECK_FILLER, 14)
    .WithCardInDeckForPlayer(1, DECK_FILLER)
    .WithCardInHandForPlayer(1, VANQUISH)
    .WithActivePlayer(1);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const vanquish = async (g: GameTestAdapter, cardId: string) => {
  await g.playCardFromHandAsync(1, g.state.player1.hand.findIndex(c => c.cardId === VANQUISH));
  const target = [...g.state.player1.groundArena, ...g.state.player2.groundArena].find(u => u.cardId === cardId)!;
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [target.playId] });
};
const deckTop = (g: GameTestAdapter) => g.state.player1.deck[g.state.player1.deck.length - 1]?.cardId;
const inDiscard = (g: GameTestAdapter, cardId: string) => g.state.player1.discard.some(c => c.cardId === cardId);

describe("HMW_056 Yoda — Hidden", () => {
  it("has Hidden", () => {
    expect(HasHidden(YODA)).toBe(true);
  });

  it("can't be attacked the phase he is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, YODA)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    await g.playCardFromHandAsync(1, g.state.player1.hand.findIndex(c => c.cardId === YODA));
    const yoda = g.state.player1.groundArena.find(u => u.cardId === YODA)!;
    expect(yoda).toBeDefined();

    await g.attackWithGroundUnitAsync(2, 0);
    const r = needs(g);
    const offered = r?.type === "Target" ? (r.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(yoda.playId);
  });
});

describe("HMW_056 Yoda — When Defeated", () => {
  it("Yes: goes from the discard to the top of the deck, then heals 2 from your base (UI base pick)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, YODA).Build());
    await vanquish(g, YODA);

    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(deckTop(g)).toBe(YODA);
    expect(g.state.player1.deck).toHaveLength(2);
    expect(inDiscard(g, YODA)).toBe(false);

    expect(needs(g)?.type).toBe("Target"); // now the base
    await g.chooseBaseAsync(1, 1);
    expect(g.state.player1.base.damage).toBe(8);
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("the heal may go on the enemy base (base picked by playId)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, YODA).Build());
    await vanquish(g, YODA);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });
    expect(g.state.player2.base.damage).toBe(8);
    expect(g.state.player1.base.damage).toBe(10);
  });

  it("No: Yoda stays in the discard and nothing heals", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, YODA).Build());
    await vanquish(g, YODA);
    expect(needs(g)?.type).toBe("Option"); // the offer really appeared
    await g.chooseNoAsync(1);

    expect(inDiscard(g, YODA)).toBe(true);
    expect(deckTop(g)).toBe(DECK_FILLER);
    expect(g.state.player1.base.damage).toBe(10);
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("control: a unit without the ability just stays in the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.hmw.jaxxon).Build());
    await vanquish(g, Cards.units.hmw.jaxxon);
    expect(needs(g)).toBeFalsy();
    expect(inDiscard(g, Cards.units.hmw.jaxxon)).toBe(true);
    expect(deckTop(g)).toBe(DECK_FILLER);
  });

  it("a stolen Yoda goes to its owner's discard — not 'your' discard — so there is no offer", async () => {
    const g = new GameTestAdapter();
    // Owned by P2, controlled by P1.
    g.loadNewState(base().WithGroundUnitForPlayer(1, YODA, true, 0, 1).Build());
    g.state.player1.groundArena[0].owner = 2;
    await vanquish(g, YODA);
    expect(needs(g)).toBeFalsy();
    expect(g.state.player2.discard.some(c => c.cardId === YODA)).toBe(true);
    expect(g.state.player1.base.damage).toBe(10);
  });
});
