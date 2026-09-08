import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// SEC_009 Mon Mothma — Forming a Coalition. Cost 5, 3/7 Ground Republic/Official leader.
//   Leader:   "Ignore the aspect penalties on non-Villainy Official units you play.
//              Epic Action: If you control 5 or more resources, deploy this leader."
//   Deployed: "Ignore the aspect penalties on non-Villainy Official units you play.
//              Each other friendly Official unit gets +0/+1."
//
// The waiver is printed on BOTH sides, so deploying her must not switch it off. Villainy is the
// only thing that disqualifies an Official unit, which is what separates the two fixtures below:
// they share the Official trait and differ only on that aspect.

const MON_MOTHMA = Cards.leaders.sec.monMothma;
const OFFICIAL = Cards.units.ash.remnantOfficial;              // 3/3, [Vigilance], Official, cost 3
const VILLAINY_OFFICIAL = Cards.units.ash.moffGideonRemnantCommander; // [Command,Villainy], Official, cost 3
const MARINE = Cards.units.sor.battlefieldMarine;

/** Command base + Command/Heroism leader, so a Vigilance card is off-aspect by 2. */
function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(MON_MOTHMA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

const spent = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;

describe("SEC_009 Mon Mothma — Forming a Coalition", () => {
  describe("aspect-penalty waiver", () => {
    it("waives the penalty on a non-Villainy Official unit (leader side)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, OFFICIAL).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(spent(g)).toBe(3); // printed cost, no +2 off-aspect penalty
    });

    it("still waives it once she is DEPLOYED — the text is on both sides", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, OFFICIAL).Build());

      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      const afterDeploy = spent(g);

      await g.playCardFromHandAsync(1, 0);

      expect(spent(g) - afterDeploy).toBe(3);
    });

    it("does NOT waive it on a VILLAINY Official unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, VILLAINY_OFFICIAL).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(spent(g)).toBe(5); // cost 3 + 2 off-aspect
    });

    it("does NOT waive it on a non-Official unit", async () => {
      const g = new GameTestAdapter();
      // Wampa is [Aggression] with no Official trait — off-aspect and unwaived.
      g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.sor.wampa).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(spent(g)).toBe(6); // cost 4 + 2 off-aspect
    });

    it("control: a different leader does not waive the penalty at all", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().MyLeader(Cards.leaders.sor.sabineWren).WithCardInHandForPlayer(1, OFFICIAL).Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(spent(g)).toBe(5);
    });
  });

  // Her Epic Action threshold and her deploy cost are both 5, so this holds whether the engine
  // reads the printed condition or falls back to the cost check.
  it("cannot deploy below 5 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(MON_MOTHMA)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, MARINE, 4)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.leader.deployed).toBeFalsy();
  });

  describe("deployed side: each OTHER friendly Official unit gets +0/+1", () => {
    it("raises another friendly Official unit's HP by 1, leaving power alone", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, OFFICIAL).Build());

      await g.deployLeaderAsync(1);

      const official = Unit.FromInterface(
        g.state.player1.groundArena.find(u => u.cardId === OFFICIAL)!,
      );
      expect(official.TotalHP()).toBe(4); // printed 3
      expect(official.CurrentPower()).toBe(3);
    });

    it("does not apply before she deploys", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, OFFICIAL).Build());

      const official = Unit.FromInterface(
        g.state.player1.groundArena.find(u => u.cardId === OFFICIAL)!,
      );
      expect(official.TotalHP()).toBe(3);
    });

    it("does not buff a non-Official friendly unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());

      await g.deployLeaderAsync(1);

      const marine = Unit.FromInterface(
        g.state.player1.groundArena.find(u => u.cardId === MARINE)!,
      );
      expect(marine.TotalHP()).toBe(3);
    });

    it("does not buff an ENEMY Official unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(2, OFFICIAL).Build());

      await g.deployLeaderAsync(1);

      const enemy = Unit.FromInterface(
        g.state.player2.groundArena.find(u => u.cardId === OFFICIAL)!,
      );
      expect(enemy.TotalHP()).toBe(3);
    });

    it("does not buff HERSELF — the clause says EACH OTHER", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().Build());

      await g.deployLeaderAsync(1);

      const her = Unit.FromInterface(
        g.state.player1.groundArena.find(u => u.cardId === MON_MOTHMA)!,
      );
      expect(her.TotalHP()).toBe(7); // printed 3/7, un-buffed
    });
  });
});
