import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_235 HK-87 Assassin Droid (4/4 Ground, cost 5, Villainy) and its IC27_182 reprint
//   "When Defeated: Deal 2 damage to each ground unit."
// Both players' ground units; space is untouched. The units it defeats must be swept.

const MARINE = Cards.units.sor.battlefieldMarine;        // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce;  // 3/7
const WAMPA = Cards.units.sor.wampa;                     // 4/5
const PATROL = Cards.units.sor.systemPatrolCraft;        // space

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

for (const [label, HK] of [
  ["LOF_235", Cards.units.lof.hk87AssassinDroid],
  ["IC27_182", Cards.units.ic27.hk87AssassinDroid],
] as const) {
  describe(`${label} HK-87 Assassin Droid — When Defeated`, () => {
    it("defeated in combat: 2 damage to each ground unit, and the units it kills are defeated", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board()
          .WithGroundUnitForPlayer(1, HK)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, WAMPA)     // takes 4 from HK, then 2 more: defeated
          .WithGroundUnitForPlayer(2, SECURITY)
          .WithSpaceUnitForPlayer(2, PATROL)
          .Build(),
      );
      const wampaPlayId = g.state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampaPlayId] }); // Wampa's 4 kills HK

      expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
      expect(g.state.player1.groundArena[0].damage).toBe(2); // friendly units are hit too
      expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([SECURITY]);
      expect(g.state.player2.groundArena[0].damage).toBe(2);
      expect(g.state.player2.spaceArena[0].damage).toBe(0);  // ground only
    });

    it("defeated by an event: the blast still fires and sweeps", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board()
          .WithGroundUnitForPlayer(1, HK)
          .WithGroundUnitForPlayer(2, MARINE)
          .WithCardInHandForPlayer(1, Cards.events.twi.lethalCrackdown)
          .Build(),
      );
      g.state.player2.groundArena[0].damage = 1; // 2 HP left: the blast is lethal

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

      expect(g.state.player1.groundArena).toHaveLength(0);
      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player2.discard.map(c => c.cardId)).toContain(MARINE);
    });
  });
}
