import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// HMW_011 Darth Sidious — There is No Mercy (Leader; deployed 4/5 Ground, Force/Sith)
//   Leader:   "When you deal 4 or more damage to a unit or a base: You may exhaust this leader.
//              If you do, deal 1 damage to a different unit or base."
//              "Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed: "Hidden"
//             "When you deal 4 or more damage to a unit or a base: You may deal 1 damage to a
//              different unit or base."
//
// The threshold is ONE INSTANCE of 4+ damage, not a running total, and the source is the PLAYER —
// so it must fire on combat damage, on ability damage, and on base damage alike. That is four
// separate sites in the engine: the two combat-damage applications in resolveAttack (which never
// go through DealDamageToUnit) plus DealDamageToUnit and DealDamageToBase, whose `sourcePlayer` /
// `byPlayer` arguments are OPTIONAL and undefined for most callers.
//
// "A different unit or base" excludes only the thing just damaged — everything else is fair game,
// including your own board.

const SIDIOUS = Cards.leaders.hmw.darthSidious;
const BIG = Cards.units.ash.dinosaurTurtle;         // 7/7 Ground — 7 combat damage, over the bar
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground — 3 damage, under the bar
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground — survives a big hit

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP) // Aggression
    .MyLeader(SIDIOUS)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

describe("HMW_011 Darth Sidious — There is No Mercy", () => {
  describe("leader side — you may exhaust to deal 1 more", () => {
    it("fires on 4+ COMBAT damage and deals 1 to a different unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, BIG)   // 7 power
          .WithGroundUnitForPlayer(2, CSF)   // takes 7
          .WithGroundUnitForPlayer(2, MARINE) // the "different" target
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);
      const marineIdx = g.state.player2.groundArena.findIndex(u => u.cardId === MARINE);
      await g.chooseGroundUnitAsync(2, marineIdx);

      expect(g.state.player2.groundArena.find(u => u.cardId === MARINE)!.damage).toBe(1);
      expect(g.state.player1.leader.ready).toBe(false); // the exhaust is the cost
    });

    it("declining changes nothing and leaves the leader ready", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, BIG)
          .WithGroundUnitForPlayer(2, CSF)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

      await g.chooseNoAsync(1);

      expect(g.state.player2.groundArena.find(u => u.cardId === MARINE)!.damage).toBe(0);
      expect(g.state.player1.leader.ready).toBe(true);
    });

    it("does NOT fire below 4 damage", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE) // only 3 power
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(g.state.player1.leader.ready).toBe(true);
    });

    it("fires on 4+ damage dealt to a BASE", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, BIG)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2); // 7 to the enemy base

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(1);
    });

    it("cannot re-hit the same target — 'a DIFFERENT unit or base'", async () => {
      // Asserted against a BASE: a unit that just took 4+ damage has usually died, so the base is
      // the target that reliably survives to prove the exclusion.
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, BIG)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);  // 7 to the enemy base
      await g.chooseYesAsync(1);

      const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

      expect(result.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player2.base.damage).toBe(7); // still just the attack, no extra point
    });

    it("does not prompt when the leader is already exhausted — it cannot pay", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .MyLeader(SIDIOUS, false) // exhausted
          .WithGroundUnitForPlayer(1, BIG)
          .WithGroundUnitForPlayer(2, CSF)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });
  });

  describe("deployed side — free, plus Hidden", () => {
    it("has Hidden", () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());

      expect(HasKeyword(SIDIOUS, "Hidden")).toBe(true);
    });

    it("fires with no exhaust cost", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(6)
          .WithGroundUnitForPlayer(1, BIG)
          .WithGroundUnitForPlayer(2, CSF)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      const bigIdx = g.state.player1.groundArena.findIndex(u => u.cardId === BIG);
      await g.attackWithGroundUnitAsync(1, bigIdx);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);
      const marineIdx = g.state.player2.groundArena.findIndex(u => u.cardId === MARINE);
      await g.chooseGroundUnitAsync(2, marineIdx);

      expect(g.state.player2.groundArena.find(u => u.cardId === MARINE)!.damage).toBe(1);
      // Deployed Sidious is a unit now; nothing was exhausted to pay for this.
      const sidious = g.state.player1.groundArena.find(u => u.cardId === SIDIOUS)!;
      expect(sidious.ready).toBe(true);
    });
  });

  it("Operation Cinder: every 4+ instance triggers separately — 12 damage to the enemy base", async () => {
    // ASH_151: "Deal 5 damage to your base. Then, deal 5 damage to each unit."
    //
    // The board is 5 TIE tokens in space, 5 Battle Droids on the ground and deployed Sidious =
    // 11 units, plus the caster's own base. Every one of those is a SEPARATE instance of 5
    // damage, and 5 ≥ 4, so Sidious triggers 12 times and each point can go to the enemy base:
    //   1 (own base) + 11 (units) = 12.
    //
    // Two things this pins down that nothing else does:
    //   - the reaction fires on damage you deal to your OWN board, not just the opponent's;
    //   - it resolves 12 times rather than once, because the threshold is per INSTANCE.
    // It also covers Sidious dying to the very damage that triggered him — he is 4/5 and takes 5,
    // so every trigger after his death must still resolve. An ability that has triggered does not
    // un-trigger, and the deployed side costs nothing, so nothing is left to pay.
    const g = new GameTestAdapter();
    let b = setup(14)
      .MyBase(Cards.bases.common.red30HP, 0)
      .WithCardInHandForPlayer(1, Cards.events.ash.operationCinder);
    for (let i = 0; i < 5; i++) b = b.WithSpaceUnitForPlayer(1, Cards.units.token.tieFighter);
    for (let i = 0; i < 5; i++) b = b.WithGroundUnitForPlayer(1, Cards.units.token.battleDroid);
    g.loadNewState(b.Build());

    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    expect(g.state.player1.groundArena.length + g.state.player1.spaceArena.length).toBe(11);

    await g.playCardFromHandAsync(1, 0);

    // Answer every offer, aiming each point at the enemy base.
    let fired = 0;
    for (let guard = 0; guard < 30; guard++) {
      const needs = g.lastDispatchResponse?.resolutionNeeded;
      if (needs?.type === "Option") {
        await g.chooseYesAsync(1);
        await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });
        fired += 1;
        continue;
      }
      break;
    }

    expect(fired).toBe(12);
    expect(g.state.player2.base.damage).toBe(12);
    expect(g.state.player1.base.damage).toBe(5); // Operation Cinder's own 5
  });

  it("Epic Action: deploys at 6 resources, spending none", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(6);
  });
});
