import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_152 Mace Windu's Lightsaber (Upgrade, cost 2)
//   "Attach to a non-Vehicle unit.
//    When Played: If attached unit is Mace Windu, draw 2 cards."
//
// The condition is on the NAME, not a trait — and several cards are titled "Mace Windu"
// (SOR_149, LOF_149, and the TWI_013 leader unit), so it must match by title, not card id.

const MARINE = Cards.units.sor.battlefieldMarine;
const SABER = Cards.upgrades.twi.maceWindusLightsaber;
const MACE_UNIT = Cards.units.sor.maceWinduUnit; // SOR_149 — titled "Mace Windu"
const AWING = Cards.units.jtl.phoenixSquadronAWing; // Vehicle — illegal host

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInHandForPlayer(1, SABER);
}

describe("TWI_152 Mace Windu's Lightsaber", () => {
  it("draws 2 cards when attached to Mace Windu", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MACE_UNIT).Build());
    const handBefore = g.state.player1.hand.length;
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    // -1 for the saber leaving hand, +2 drawn
    expect(g.state.player1.hand).toHaveLength(handBefore - 1 + 2);
    expect(g.state.player1.deck).toHaveLength(deckBefore - 2);
  });

  it("draws nothing when attached to anyone else (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());
    const handBefore = g.state.player1.hand.length;
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(handBefore - 1);
    expect(g.state.player1.deck).toHaveLength(deckBefore);
  });

  it("still attaches, and gives its stat bonus, on a non-Mace host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === SABER)).toBe(true);
  });

  it("cannot attach to a Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(1, AWING)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const vehicle = g.state.player1.spaceArena[0];
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vehicle.playId] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
