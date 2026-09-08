import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// HMW_001 Asajj Ventress — No Time For Regret (Leader; deployed 3/6 Ground, Force/Night)
//   Leader:   "Action [Exhaust]: Attack with a unit. For this attack replace any Raid it has or
//              gains with Restore, or vice versa."
//             "Epic Action: If you control 5 or more resources, deploy this leader."
//   Deployed: "Restore 2"
//             "Action: Attack with a unit. For this attack, replace any Raid it has or gains with
//              Restore, or vice versa."
//
// The replacement is the whole card, and it is DIRECTIONAL: you choose which keyword is replaced,
// and the replaced value is ADDED to the survivor rather than traded for it. On a unit with both
// (LAW_050 Honnah, Raid 2 + Restore 2) that is Restore 4 or Raid 4 — see honnah.test.ts, which is
// the case that proves it. Treating it as a symmetric swap makes such a unit a no-op.
//
// Raid and Restore each have exactly ONE consumption site — Unit.CurrentPower() while attacking,
// and resolveAttack's base heal — and both now read EffectiveRaid/EffectiveRestore live, which is
// what makes "any Raid it has OR GAINS" work.
//
// The two sides differ in cost: the leader side exhausts, the deployed side is a plain "Action:".
// ActionAbilityExhausts is keyed by cardId and cannot tell them apart (the LAW_015 Jabba
// collision), so it returns false and the leader path exhausts the leader itself.

const ASAJJ = Cards.leaders.hmw.asajjVentress;
/** Prompt ids; the human wording lives in optionLabels. */
const TO_RESTORE = "HMW_001_to_restore";
const TO_RAID = "HMW_001_to_raid";
const RAIDER = "IBH_004";                          // Rogue Squadron Speeder — 3/5, Raid 1, nothing else
const RESTORER = Cards.units.ash.remnantOfficial;  // 3/3, Restore 2, nothing else
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3, no keywords
const CSF = Cards.units.sor.consularSecurityForce; // 3/7

function setup(resources = 6) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)   // pre-damaged so Restore is observable
    .MyLeader(ASAJJ)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

const useLeaderAction = (g: GameTestAdapter) =>
  g.dispatchAsync(1, "use-ability", { cardId: ASAJJ });

describe("HMW_001 Asajj Ventress — No Time For Regret", () => {
  describe("Raid / Restore replacement", () => {
    it("replacing Raid with Restore: no power bonus, base healed instead", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, RAIDER).Build());

      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, 0);  // attack with the Raid 1 unit
      await g.chooseOptionAsync(1, TO_RESTORE);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(3); // 3 power, NOT 4 — Raid did not apply
      expect(g.state.player1.base.damage).toBe(9); // 10 - 1, healed as though Restore 1
    });

    it("replacing Restore with Raid: power bonus, no healing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, RESTORER).Build());

      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseOptionAsync(1, TO_RAID);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(5); // 3 power + 2, as though Raid 2
      expect(g.state.player1.base.damage).toBe(10); // unhealed — Restore did not apply
    });

    it("a unit with neither keyword is unaffected", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseOptionAsync(1, TO_RESTORE);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(3);
      expect(g.state.player1.base.damage).toBe(10);
    });

    it("control: the same Raid unit attacking NORMALLY keeps its Raid", async () => {
      // Proves the swap is what changed the numbers, not something incidental.
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, RAIDER).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(4); // 3 + Raid 1
      expect(g.state.player1.base.damage).toBe(10);
    });

    it("control: the same Restore unit attacking NORMALLY keeps its Restore", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, RESTORER).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(3);
      expect(g.state.player1.base.damage).toBe(8); // 10 - Restore 2
    });

    it("the replacement expires with the attack — a later attack behaves normally", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, RAIDER)
          .WithGroundUnitForPlayer(1, RAIDER)
          .Build(),
      );

      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseOptionAsync(1, TO_RESTORE);
      await g.chooseBaseAsync(1, 2);
      expect(g.state.player2.base.damage).toBe(3); // replaced

      await g.dispatchAsync(2, "pass-action", {});
      await g.attackWithGroundUnitAsync(1, 1);     // the OTHER raider, ordinary attack
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(7); // 3 + (3 + Raid 1)
    });

    it("only the chosen attacker is affected", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(1, RAIDER)
          .Build(),
      );

      const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, marineIdx);  // replace on the Marine, not the raider
      await g.chooseOptionAsync(1, TO_RESTORE);
      await g.chooseBaseAsync(1, 2);

      await g.dispatchAsync(2, "pass-action", {});
      const raiderIdx = g.state.player1.groundArena.findIndex(u => u.cardId === RAIDER);
      await g.attackWithGroundUnitAsync(1, raiderIdx);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(7); // 3 (marine) + 4 (raider keeps Raid)
      expect(g.state.player1.base.damage).toBe(10);
    });
  });

  describe("the leader-side Action", () => {
    it("exhausts the leader", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("costs no resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());
      const before = g.state.player1.resources.filter(r => r.ready).length;

      await useLeaderAction(g);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player1.resources.filter(r => r.ready).length).toBe(before);
    });

    it("is not offered with no unit able to attack", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());

      await useLeaderAction(g);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.player1.leader.ready).toBe(true); // no cost paid for an ability that never ran
    });

    it("can send an already-exhausted unit? no — it needs a unit that can attack", async () => {
      // "Attack with a unit" without an "even if exhausted" clause means a READY unit.
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).Build());

      await useLeaderAction(g);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });
  });

  describe("Epic Action: deploy at 5+ resources", () => {
    it("deploys with 5 resources", async () => {
      // NOTE: these two tests pin observable behaviour, not the registration. Asajj's printed cost
      // is ALSO 5, and an unregistered leader falls through to a `resources.length < playCost`
      // gate — same threshold. The engine's normal deploy path never charges deployCost either
      // (it is only checked, and only spent on the pilot branch), so the resources left behind
      // do not discriminate the paths either. For THIS card the two are indistinguishable through
      // gameplay; the registration is verified by reading it, not by a test that cannot fail.
      const g = new GameTestAdapter();
      g.loadNewState(setup(5).Build());

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(true);
      expect(g.state.player1.groundArena.some(u => u.cardId === ASAJJ)).toBe(true);
    });

    it("does not deploy with 4", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(4).Build());

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(false);
    });
  });

  describe("the deployed side", () => {
    async function deployed(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.Build());
      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      return g;
    }

    it("has Restore 2", () => {
      expect(RestoreAmount(ASAJJ)).toBe(2);
    });

    it("heals 2 when she attacks", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(2, CSF));
      const asajjIdx = g.state.player1.groundArena.findIndex(u => u.cardId === ASAJJ);

      await g.attackWithGroundUnitAsync(1, asajjIdx);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player1.base.damage).toBe(8); // 10 - 2
    });

    it("its Action does NOT exhaust her — a plain 'Action:'", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(1, MARINE));
      const asajjPlayId = g.state.player1.groundArena.find(u => u.cardId === ASAJJ)!.playId;
      const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);

      await g.dispatchAsync(1, "use-ability", { playId: asajjPlayId });
      await g.chooseGroundUnitAsync(1, marineIdx);
      await g.chooseBaseAsync(1, 2);

      const asajj = g.state.player1.groundArena.find(u => u.cardId === ASAJJ)!;
      expect(asajj.ready).toBe(true);
    });

    it("its Action applies the replacement too", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(1, RAIDER));
      const asajjPlayId = g.state.player1.groundArena.find(u => u.cardId === ASAJJ)!.playId;
      const raiderIdx = g.state.player1.groundArena.findIndex(u => u.cardId === RAIDER);
      const baseBefore = g.state.player1.base.damage;

      await g.dispatchAsync(1, "use-ability", { playId: asajjPlayId });
      await g.chooseGroundUnitAsync(1, raiderIdx);
      await g.chooseOptionAsync(1, TO_RESTORE);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(3);        // Raid suppressed
      expect(g.state.player1.base.damage).toBe(baseBefore - 1); // healed 1 instead
    });
  });
});
