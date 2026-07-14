import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_004 Yoda — Sensing Darkness (4/9 Ground, Force/Jedi/Republic)
// Leader:   "Action [Exhaust]: If a unit left play this phase, draw a card, then put a card
//            from your hand on the top or bottom of your deck."
// Deployed: "Restore 2"
//           "When Deployed: You may discard a card from your deck. If you do, defeat an enemy
//            non-leader unit that costs the same as or less than the discarded card."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.twi.yoda)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes so player 1 can act twice
}

describe("TWI_004 Yoda — Leader ability", () => {
  it("draws a card, then puts a chosen card on the BOTTOM of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish) // kill a unit so one leaves play
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards) // the card that gets drawn
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // Vanquish
    await g.chooseGroundUnitAsync(2, 0); // a unit leaves play this phase
    const deckBefore = g.state.player1.deck.length;

    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.hand).toHaveLength(1); // drew the Guards
    expect(g.state.player1.deck.length).toBe(deckBefore - 1);

    await g.chooseCardFromHandAsync(1, 0); // put it back
    await g.chooseOptionAsync(1, "bottom");

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck.length).toBe(deckBefore); // net zero
    expect(g.state.player1.deck[0].cardId).toBe(Cards.units.sor.gamorreanGuards); // bottom
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
  });

  it("can put the card on the TOP of the deck instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        // Two distinct deck cards, so "top" and "bottom" are actually distinguishable.
        .WithCardInDeckForPlayer(1, Cards.units.sor.deathTrooper) // bottom
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards) // top — this gets drawn
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([Cards.units.sor.gamorreanGuards]);

    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "top");

    const deck = g.state.player1.deck;
    expect(g.state.player1.hand).toHaveLength(0);
    expect(deck.map(c => c.cardId)).toEqual([
      Cards.units.sor.deathTrooper, // still the bottom
      Cards.units.sor.gamorreanGuards, // back on top (the end of the array)
    ]);
  });

  it("soft-passes when no unit left play this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.hand).toHaveLength(0); // no draw
    expect(g.state.player1.leader.ready).toBe(false); // still exhausts, like Iden Versio
  });
});

describe("TWI_004 Yoda — Deployed leader unit", () => {
  function deploySetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.yoda)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10); // ≥7 to deploy
  }

  it("When Deployed: discards from deck and defeats an enemy unit costing the same or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deploySetup()
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards) // cost 4 → allows ≤4
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2 — eligible
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1); // "You may discard a card from your deck"
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(0); // the card was discarded from the deck
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.gamorreanGuards);
  });

  it("declining the optional discard defeats nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deploySetup()
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const deployed = await g.deployLeaderAsync(1);
    // The optional prompt must actually be raised — otherwise "No" is a silent no-op
    // and this test would pass even with the ability unimplemented.
    expect(deployed.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1); // untouched
    expect(g.state.player1.deck).toHaveLength(1); // nothing discarded
  });

  it("cannot defeat an enemy unit that costs more than the discarded card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deploySetup()
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 → allows ≤2
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // cost 7 — too expensive
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);

    // Nothing is eligible, so the walker survives (the card is still discarded).
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("cannot defeat a FRIENDLY unit ('an enemy non-leader unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deploySetup()
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards) // cost 4
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly, cost 2
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);

    // No ENEMY unit is eligible → the friendly Marine is never offered and survives.
    expect(
      g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine),
    ).toBe(true);
  });

  it("has Restore 2 (heals 2 from your base when it attacks)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5) // 5 damage to restore from
        .MyLeader(Cards.leaders.twi.yoda)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithInitiativePlayerBeing(2)
        .WithInitiativeClaimed()
        .Build(),
    );

    await g.deployLeaderAsync(1);

    const yodaIdx = g.state.player1.groundArena.findIndex(
      u => u.cardId === Cards.leaders.twi.yoda,
    );
    await g.attackWithGroundUnitAsync(1, yodaIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(3); // 5 - 2 restored
  });
});
