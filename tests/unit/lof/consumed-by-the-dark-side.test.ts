import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_239 Consumed by the Dark Side (Event, cost 2, Villainy) and its IC27_184 reprint
//   "Give 2 Experience tokens to a unit, then deal 2 damage to it."
// Mandatory, any unit. Order matters: the tokens land first, so a unit with 2 HP left survives.

const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const XP = Cards.upgrades.token.experience;

function board(event: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, event)
    .WithGroundUnitForPlayer(2, MARINE);
}

for (const [label, EVENT] of [
  ["LOF_239", Cards.events.lof.consumedByTheDarkSide],
  ["IC27_184", Cards.events.ic27.consumedByTheDarkSide],
] as const) {
  describe(`${label} Consumed by the Dark Side`, () => {
    it("gives 2 Experience, then deals 2 damage to the chosen unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(EVENT).Build());

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target"); // mandatory — no yes/no
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      const marine = g.state.player2.groundArena[0];
      expect(marine.upgrades.filter(u => u.cardId === XP)).toHaveLength(2);
      expect(marine.damage).toBe(2);
    });

    it("tokens land BEFORE the damage: a unit with 2 HP left survives", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(EVENT).Build());
      g.state.player2.groundArena[0].damage = 1; // 3/3 with 2 HP left

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      expect(g.state.player2.groundArena).toHaveLength(1); // 5 HP after the tokens, 3 damage
      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("can target a friendly unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(EVENT).WithGroundUnitForPlayer(1, MARINE).Build());
      const friendly = g.state.player1.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendly] });

      expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === XP)).toHaveLength(2);
    });
  });
}
