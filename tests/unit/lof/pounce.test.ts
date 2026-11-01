import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_224 Pounce (Event, cost 2, Cunning, Trick) and its HMW_239 reprint
//   "Attack with a Creature unit. It gets +4/+0 for this attack."
// IBH_021 Improvised Detonation's shape, narrowed to Creatures and +4 instead of +2.

const CREATURE = Cards.units.hmw.filthyDianoga;   // 5/5 Ground Creature, no text
const NON_CREATURE = Cards.units.sor.battlefieldMarine; // 3/3 Ground Rebel/Trooper

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, NON_CREATURE, 6);
}

for (const [label, POUNCE] of [
  ["LOF_224", Cards.events.lof.pounce],
  ["HMW_239", Cards.events.hmw.pounce],
] as const) {
  describe(`${label} Pounce`, () => {
    it("the chosen Creature attacks with +4/+0", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, POUNCE).WithGroundUnitForPlayer(1, CREATURE).Build());

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(9); // 5 + 4
      expect(g.state.player1.groundArena[0].ready).toBe(false);
    });

    it("only ready Creature units are offered", async () => {
      const g = new GameTestAdapter();
      const state = board()
        .WithCardInHandForPlayer(1, POUNCE)
        .WithGroundUnitForPlayer(1, NON_CREATURE)
        .WithGroundUnitForPlayer(1, CREATURE)
        .WithGroundUnitForPlayer(1, CREATURE, false) // exhausted
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
      expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[1].playId]);
    });

    it("no Creature: the event resolves with no attack (control)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, POUNCE).WithGroundUnitForPlayer(1, NON_CREATURE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player2.base.damage).toBe(0);
      expect(g.state.player1.groundArena[0].ready).toBe(true);
    });
  });
}
