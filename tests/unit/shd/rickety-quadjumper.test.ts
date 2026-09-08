import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_057 Rickety Quadjumper (1/3 Space, cost 2, Vigilance, Fringe/Vehicle/Transport) —
//   "On Attack: You may reveal the top card of your deck. If it's not a unit, give an Experience
//    token to another unit. (Leave the revealed card on top of your deck.)"
//
// Three things to get right: the reveal is OPTIONAL; the grant is conditional on the revealed card
// NOT being a unit; and the deck must be left exactly as it was — the card is revealed, not drawn.
//
// "Another unit" excludes the Quadjumper itself.

const QUAD = "SHD_057";
const XP = Cards.upgrades.token.experience;
const UNIT_CARD = Cards.units.sor.battlefieldMarine;
const NON_UNIT = Cards.events.sor.repair;           // an Event
const OTHER = "SHD_063";                            // System Patrol Craft, another space unit

function setup(topOfDeck: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, UNIT_CARD, 14)
    .WithSpaceUnitForPlayer(1, QUAD)
    .WithCardInDeckForPlayer(1, topOfDeck)          // the END of the deck array is the top
    .WithActivePlayer(1);
}

const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("SHD_057 Rickety Quadjumper", () => {
  it("grants an Experience token when the revealed card is NOT a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NON_UNIT).WithGroundUnitForPlayer(1, UNIT_CARD).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
  });

  it("grants nothing when the revealed card IS a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(UNIT_CARD).WithGroundUnitForPlayer(1, UNIT_CARD).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("leaves the revealed card on top of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NON_UNIT).WithGroundUnitForPlayer(1, UNIT_CARD).Build());
    const deckBefore = g.state.player1.deck.length;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.deck).toHaveLength(deckBefore);
    expect(g.state.player1.deck[g.state.player1.deck.length - 1].cardId).toBe(NON_UNIT);
  });

  it("is optional — declining reveals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NON_UNIT).WithGroundUnitForPlayer(1, UNIT_CARD).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("does not offer ITSELF — the text says 'another unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NON_UNIT).WithSpaceUnitForPlayer(1, OTHER).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    const self = g.state.player1.spaceArena.find(u => u.cardId === QUAD)!;
    expect(offered).not.toContain(self.playId);
  });

  it("does not ask at all with an empty deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.directorKrennic)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, UNIT_CARD, 14)
        .WithSpaceUnitForPlayer(1, QUAD)
        .WithGroundUnitForPlayer(1, UNIT_CARD)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
