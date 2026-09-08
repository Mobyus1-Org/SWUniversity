import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_081 Alliance Shield Generator (Upgrade, cost 2, Vigilance/Heroism, Fortification) —
//   "Fortify (Attach this to your base, not a unit.)
//    If attached base would be dealt 5 or more damage, prevent that damage. If you do, defeat
//    this upgrade and draw a card."
//
// A single-use damage replacement: the whole instance is prevented, not the excess, and the
// threshold is on ONE instance of damage rather than a running total.

const SHIELD_GEN = Cards.upgrades.hmw.allianceShieldGenerator;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3 power
const BIG = Cards.units.twi.tranquility;            // 7 power, Space

function setup(withShield = true) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(2); // P2 attacks into P1's base
  if (withShield) {
    b = b.WithUpgradesOnBaseForPlayer(1, [
      { cardId: SHIELD_GEN, playId: "@", owner: 1, controller: 1 },
    ]);
  }
  return b;
}

describe("HMW_081 Alliance Shield Generator", () => {
  it("prevents a 5+ damage hit, then defeats itself and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, BIG).Build());
    const handBefore = g.state.player1.hand.length;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1); // 7 damage at P1's base

    expect(g.state.player1.base.damage).toBe(0);              // prevented outright
    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0); // defeated itself
    expect(g.state.player1.hand.length).toBe(handBefore + 1);  // drew a card
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(SHIELD_GEN);
  });

  it("lets a hit of 4 or less through and stays attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1); // only 3 damage

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player1.base.upgrades).toHaveLength(1); // still there
    expect(g.state.player1.hand.length).toBe(handBefore);  // no draw
  });

  it("control: without it, the same 7 damage lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false).WithSpaceUnitForPlayer(2, BIG).Build());

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(7);
  });

  it("only guards the base it is attached to", async () => {
    const g = new GameTestAdapter();
    // P1 holds the shield; P2's base takes the big hit and is unprotected.
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, BIG)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7);
    expect(g.state.player1.base.upgrades).toHaveLength(1); // untouched
  });

  it("is spent by the first big hit, so a second one lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(2, BIG)
        .WithSpaceUnitForPlayer(2, BIG)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);
    expect(g.state.player1.base.damage).toBe(0);

    await g.dispatchAsync(1, "pass-action", {});
    await g.attackWithSpaceUnitAsync(2, 1);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(7); // nothing left to prevent it
  });

  describe("empty-deck draw damage", () => {
    // QA: "the 6 damage taken from drawing 2 cards from an empty deck is ONE instance of 6, not
    // two instances of 3 — so ASG should prevent it."
    //
    // That distinction is the whole point of a 5-or-more threshold: 6 as one instance is
    // prevented, 3 + 3 as two instances is not. It also has to route through DealDamageToBase at
    // all — a direct `base.damage +=` bypasses every prevention and cap in the engine.

    /** Board with an empty deck for P1, and the shield attached. */
    function emptyDeck(withShield = true) {
      let b = new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 14)
        .FillResourcesForPlayer(2, MARINE, 14)
        .WithCardInDeckForPlayer(2, MARINE)
        .WithCardInDeckForPlayer(2, MARINE)
        .WithActivePlayer(1);
      if (withShield) {
        b = b.WithUpgradesOnBaseForPlayer(1, [
          { cardId: SHIELD_GEN, playId: "@", owner: 1, controller: 1 },
        ]);
      }
      return b;
    }

    async function passTheRound(g: GameTestAdapter) {
      await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
      await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
      await g.passResourceAsync(g.state.activePlayer);
      await g.passResourceAsync(g.state.activePlayer);
    }

    it("control: without the shield, the regroup draw of 2 deals 6", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(emptyDeck(false).Build());

      await passTheRound(g);

      expect(g.state.player1.base.damage).toBe(6);
    });

    it("prevents the regroup draw of 2 from an empty deck — one instance of 6", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(emptyDeck().Build());

      await passTheRound(g);

      // Prevented outright. ASG then defeats itself and draws — and THAT draw is also from an
      // empty deck, so 3 damage does land. The 6 does not.
      expect(g.state.player1.base.damage).toBe(3);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
    });

    it("Mission Briefing's draw 2 from an empty deck is ONE instance of 6, so ASG prevents it", async () => {
      // The action-phase counterpart to the regroup case, driven through a real card:
      // SOR_171 "Choose a player. They draw 2 cards." Looping the draw would deal 3 + 3, and
      // neither instance reaches ASG's 5-or-more threshold.
      const g = new GameTestAdapter();
      g.loadNewState(
        emptyDeck()
          .WithCardInHandForPlayer(1, Cards.events.sor.missionBriefing)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1); // draw them myself

      expect(g.state.player1.base.damage).toBe(3); // the 6 prevented; ASG's own draw deals 3
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
    });

    it("control: without the shield, Mission Briefing's empty-deck draw deals the full 6", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        emptyDeck(false)
          .WithCardInHandForPlayer(1, Cards.events.sor.missionBriefing)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);

      expect(g.state.player1.base.damage).toBe(6);
    });
  });
});
