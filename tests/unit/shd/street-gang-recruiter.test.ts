import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_260 Street Gang Recruiter (4/4 Ground, cost 5, no aspect, Underworld) and its LAW_261 reprint
//   "When Played: You may return an Underworld card from your discard pile to your hand."
// Any CARD type — units, events and upgrades alike — as long as it is Underworld.

const UW_UNIT = Cards.units.hmw.jaxxon;          // Underworld unit, no text
const UW_EVENT = Cards.events.shd.maKlounkee;    // Underworld event
const NON_UW = Cards.units.sor.battlefieldMarine; // Rebel/Trooper

function board(recruiter: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, NON_UW, 8)
    .WithCardInHandForPlayer(1, recruiter);
}

for (const [label, RECRUITER] of [
  ["SHD_260", Cards.units.shd.streetGangRecruiter],
  ["LAW_261", Cards.units.law.streetGangRecruiter],
] as const) {
  describe(`${label} Street Gang Recruiter — When Played`, () => {
    it("may return an Underworld unit from the discard pile to hand", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(RECRUITER).WithCardInDiscardForPlayer(1, UW_UNIT).Build());
      const discardPlayId = g.state.player1.discard[0].playId;

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId] });

      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([UW_UNIT]);
      expect(g.state.player1.discard).toHaveLength(0);
    });

    it("an Underworld EVENT is a legal pick — 'card', not 'unit'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(RECRUITER).WithCardInDiscardForPlayer(1, UW_EVENT).Build());
      const discardPlayId = g.state.player1.discard[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId] });

      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([UW_EVENT]);
    });

    it("declining leaves the discard pile untouched", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(RECRUITER).WithCardInDiscardForPlayer(1, UW_UNIT).Build());

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(g.state.player1.discard.map(c => c.cardId)).toEqual([UW_UNIT]);
      expect(g.state.player1.hand).toHaveLength(0);
    });

    it("no prompt when the discard holds only non-Underworld cards (control)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(RECRUITER).WithCardInDiscardForPlayer(1, NON_UW).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player1.discard).toHaveLength(1);
    });
  });
}
