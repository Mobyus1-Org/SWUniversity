import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_041 Annihilator — Tagge's Flagship (12/12 Space, cost 11, unique, Vigilance/Villainy)
//   "When Played/When Defeated: You may defeat an enemy unit. If you do, search its controller's deck
//    and hand for each card with that unit's name and discard them. (They shuffle their deck.)"
//
// "That unit's name" is its TITLE, so every Millennium Falcon counts whatever its subtitle. Before
// the discard, the searching player is shown the searched deck and acknowledges it with OK.

const ANNIHILATOR = Cards.units.jtl.annihilator;
const FALCON = Cards.units.jtl.millenniumFalcon;                    // Get Out And Push — the target
const FALCON_B = Cards.units.law.millenniumFalconDodgingPatrols;
const FALCON_C = Cards.units.shd.millenniumFalconLandosPride;
const MARINE = Cards.units.sor.battlefieldMarine;                   // filler — never discarded
const SECURITY = Cards.units.sor.consularSecurityForce;
const OFFICIAL = Cards.units.twi.wartimeTradeOfficial;              // "When Defeated: Create a Battle Droid token."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)             // Vigilance
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)     // Command/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, ANNIHILATOR);
}

type Res = { type?: string; fromPlayIds?: string[]; options?: string[]; cards?: { cardId: string }[] };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;
const ids = (cards: { cardId: string }[]) => cards.map(c => c.cardId);

/** Plays Annihilator, says yes, and defeats the unit with `targetPlayId`. */
async function playAndDefeat(g: GameTestAdapter, targetPlayId: string) {
  await g.playCardFromHandAsync(1, 0);
  expect(res(g).type).toBe("Option");
  await g.chooseYesAsync(1);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });
}

describe("JTL_041 Annihilator — When Played", () => {
  it("defeats the enemy unit, shows its controller's deck, then discards every card with that name from hand and deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FALCON)
      .WithCardInHandForPlayer(2, FALCON_B).WithCardInHandForPlayer(2, MARINE)
      .WithCardInDeckForPlayer(2, MARINE).WithCardInDeckForPlayer(2, FALCON_C).WithCardInDeckForPlayer(2, SECURITY)
      .WithCardInDeckForPlayer(1, FALCON_B) // my own deck is never searched
      .Build());

    await playAndDefeat(g, g.state.player2.spaceArena[0].playId);

    // The view: P2's whole deck, nothing discarded yet.
    const view = res(g);
    expect(view.type).toBe("ViewCards");
    expect([...ids(view.cards ?? [])].sort()).toEqual([MARINE, FALCON_C, SECURITY].sort());
    expect(g.state.player2.hand).toHaveLength(2);

    await g.dispatchAsync(1, "choose-option", { option: "OK" });

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(ids(g.state.player2.hand)).toEqual([MARINE]);
    expect([...ids(g.state.player2.deck)].sort()).toEqual([MARINE, SECURITY].sort());
    expect(ids(g.state.player2.discard)).toEqual(expect.arrayContaining([FALCON, FALCON_B, FALCON_C]));
    expect(ids(g.state.player1.deck)).toEqual([FALCON_B]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("each discard is recorded as from hand or from deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FALCON)
      .WithCardInHandForPlayer(2, FALCON_B)
      .WithCardInDeckForPlayer(2, FALCON_C)
      .Build());

    await playAndDefeat(g, g.state.player2.spaceArena[0].playId);
    await g.dispatchAsync(1, "choose-option", { option: "OK" });

    const ledger = g.state.roundState.cardsDiscardedThisPhase ?? [];
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ player: 2, cardId: FALCON_B, from: "Hand" }),
      expect.objectContaining({ player: 2, cardId: FALCON_C, from: "Deck" }),
    ]));
  });

  it("same-named units still in play are untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FALCON)
      .WithSpaceUnitForPlayer(2, FALCON_B)
      .WithCardInDeckForPlayer(2, MARINE)
      .Build());

    await playAndDefeat(g, g.state.player2.spaceArena[0].playId);
    await g.dispatchAsync(1, "choose-option", { option: "OK" });

    expect(ids(g.state.player2.spaceArena)).toEqual([FALCON_B]);
  });

  it("with an empty deck there is nothing to view — hand copies are still discarded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FALCON)
      .WithCardInHandForPlayer(2, FALCON_B)
      .Build());

    await playAndDefeat(g, g.state.player2.spaceArena[0].playId);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("offers enemy units in both arenas, not friendly units, not units immune to enemy defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithSpaceUnitForPlayer(2, FALCON)
      .WithSpaceUnitForPlayer(2, Cards.units.shd.lurkingTiePhantom)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...(res(g).fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player2.groundArena[0].playId, g.state.player2.spaceArena[0].playId].sort(),
    );
  });

  it("an enemy leader unit can be chosen; it goes back to its leader zone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
      .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano) // her deployed leader unit
      .WithCardInDeckForPlayer(2, MARINE)
      .Build());

    await playAndDefeat(g, g.state.player2.groundArena[0].playId);
    await g.dispatchAsync(1, "choose-option", { option: "OK" });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.leader.deployed).toBe(false);
  });

  it("declining defeats nothing and discards nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, FALCON).WithCardInHandForPlayer(2, FALCON_B).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(res(g).type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(ids(g.state.player2.hand)).toEqual([FALCON_B]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("no enemy units: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("a stolen unit: its CONTROLLER's hand and deck are searched, and it goes to its owner's discard", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithCardInHandForPlayer(2, SECURITY)   // controller's copy — discarded
      .WithCardInHandForPlayer(1, SECURITY)   // owner's copy — NOT searched
      .Build();
    s.player2.groundArena[0].owner = 1;        // P1 owns it; P2 took control of it
    g.loadNewState(s);

    await playAndDefeat(g, g.state.player2.groundArena[0].playId);

    expect(g.state.player2.hand).toHaveLength(0);
    expect(ids(g.state.player1.hand)).toEqual([SECURITY]);
    expect(ids(g.state.player1.discard)).toContain(SECURITY); // the defeated unit went home
  });

  it("the defeated unit's own When Defeated resolves after the search", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, OFFICIAL)
      .WithCardInDeckForPlayer(2, MARINE)
      .Build());

    await playAndDefeat(g, g.state.player2.groundArena[0].playId);
    expect(res(g).type).toBe("ViewCards");
    expect(ids(g.state.player2.groundArena)).not.toContain(Cards.units.token.battleDroid); // not yet

    await g.dispatchAsync(1, "choose-option", { option: "OK" });

    expect(ids(g.state.player2.groundArena)).toEqual([Cards.units.token.battleDroid]);
  });
});

describe("JTL_041 Annihilator — When Defeated", () => {
  it("defeated by an enemy event, its controller may defeat an enemy unit and search by name", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(2)
      .FillResourcesForPlayer(2, MARINE, 10)
      .WithSpaceUnitForPlayer(1, ANNIHILATOR)
      .WithSpaceUnitForPlayer(2, FALCON)
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)
      .WithCardInHandForPlayer(2, FALCON_B)
      .WithCardInDeckForPlayer(2, FALCON_C)
      .Build());

    await g.playCardFromHandAsync(2, 0);          // P2 Vanquishes Annihilator
    await g.chooseSpaceUnitAsync(1, 0);
    expect(res(g).type).toBe("Option");
    await g.chooseYesAsync(1);                    // Annihilator's controller answers
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
    await g.dispatchAsync(1, "choose-option", { option: "OK" });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
    expect(g.state.player2.deck).toHaveLength(0);
  });
});
