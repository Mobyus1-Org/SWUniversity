import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_194 J-Type Nubian Starship (2/4 Space, cost 3) and its twin TWI_208 Favorable Delegate
// (1/5 Ground, cost 2) print the same text:
//   "When Played: Draw a card."
//   "When Defeated: Discard a card from your hand."
// The draw is SOR_111 Patrolling V-Wing's. The discard is mandatory, and only the unit's
// controller discards.

const MARINE = Cards.units.sor.battlefieldMarine;
const CONSULAR = Cards.units.sor.consularSecurityForce;
const VANQUISH = Cards.events.sor.vanquish; // "Defeat a non-leader unit."

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const twins = [
  { label: "LOF_194 J-Type Nubian Starship", id: Cards.units.lof.jTypeNubianStarship, arena: "space" },
  { label: "TWI_208 Favorable Delegate", id: Cards.units.twi.favorableDelegate, arena: "ground" },
] as const;

for (const { label, id, arena } of twins) {
  const withUnit = (b: GameStateBuilder) =>
    arena === "space" ? b.WithSpaceUnitForPlayer(1, id) : b.WithGroundUnitForPlayer(1, id);
  const chooseIt = (g: GameTestAdapter) =>
    arena === "space" ? g.chooseSpaceUnitAsync(1, 0) : g.chooseGroundUnitAsync(1, 0);

  describe(`${label} — When Played`, () => {
    it("draws a card, with no prompt", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, id).WithCardInDeckForPlayer(1, CONSULAR).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([CONSULAR]);
      expect(g.state.player1.deck).toHaveLength(0);
    });
  });

  describe(`${label} — When Defeated`, () => {
    it("its controller must discard a card from hand", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        withUnit(board())
          .WithCardInHandForPlayer(1, VANQUISH)
          .WithCardInHandForPlayer(1, MARINE)
          .WithCardInHandForPlayer(1, CONSULAR)
          .WithCardInHandForPlayer(2, MARINE)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await chooseIt(g);

      // The unit is gone; the discard is a prompt over the remaining hand.
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
      await g.chooseCardFromHandAsync(1, 1);

      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
      expect(g.state.player1.discard.map(c => c.cardId)).toContain(CONSULAR);
      expect(g.state.player2.hand).toHaveLength(1); // the opponent discards nothing
    });

    it("with an empty hand there is nothing to discard and no prompt (control)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withUnit(board()).WithCardInHandForPlayer(1, VANQUISH).Build());

      await g.playCardFromHandAsync(1, 0);
      await chooseIt(g);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(arena === "space" ? g.state.player1.spaceArena : g.state.player1.groundArena).toHaveLength(0);
    });
  });
}
