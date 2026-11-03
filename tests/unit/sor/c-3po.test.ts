import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_238 C-3PO — Protocol Droid (1/4 Ground, cost 2, Heroism) and its IC27_188 reprint
//   "When Played/On Attack: Choose a number, then look at the top card of your deck. If its cost
//    is the chosen number, you may reveal and draw it. (Otherwise, leave it on top of your deck.)"

const MARINE = Cards.units.sor.battlefieldMarine; // cost 2 — the card on top of the deck
const SECURITY = Cards.units.sor.consularSecurityForce;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, SECURITY, 14)
    .WithCardInDeckForPlayer(1, MARINE);
}

const options = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Option" ? res.options : undefined;
};

for (const [label, C3PO] of [
  ["SOR_238", Cards.units.sor.c3po],
  ["IC27_188", Cards.units.ic27.c3po],
] as const) {
  describe(`${label} C-3PO — When Played`, () => {
    it("on a cost match, may reveal and draw the top card", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, C3PO).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "2");
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);

      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
      expect(g.state.player1.deck).toHaveLength(0);
    });

    it("may decline on a match — the card stays on top", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, C3PO).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "2");
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(g.state.player1.hand).toHaveLength(0);
      expect(g.state.player1.deck.map(c => c.cardId)).toEqual([MARINE]);
    });

    it("control: a wrong number offers nothing and leaves the card on top", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, C3PO).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "3");

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player1.hand).toHaveLength(0);
      expect(g.state.player1.deck.map(c => c.cardId)).toEqual([MARINE]);
    });

    it("offers every printed cost, not just 0–8", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, C3PO).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(options(g)).toContain("0");
      expect(options(g)).toContain("10");
    });
  });

  describe(`${label} C-3PO — On Attack`, () => {
    it("chooses, draws on a match, then finishes the attack", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithGroundUnitForPlayer(1, C3PO).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.chooseOptionAsync(1, "2");
      await g.chooseYesAsync(1);

      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
      expect(g.state.player2.base.damage).toBe(1); // combat still happened
    });
  });
}
