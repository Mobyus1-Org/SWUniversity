import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_003 Doctor Hemlock — Emotion Has No Place Here (Leader; deployed 3/6 Ground, Imperial/Official)
//   Leader:   "Action [1 resource, Exhaust]: Give a Weakness token to a unit without a Weakness
//              token on it."
//              "Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed: "On Attack: You may give a Weakness token to a unit."
//
// The Weakness token (HMW_T02) is a −1/−1 UPGRADE token — the first negative upgrade in the
// engine. Its stats need no code: UpgradePowerOf/UpgradeHpOf read the generated maps, and −1 sums
// like any other upgrade. What IS new is that attaching one can be LETHAL, so the attach has to
// sweep; nothing else in the engine lowers a unit's HP by adding an upgrade.
//
// Note the asymmetry between the sides: the leader side may only target a unit WITHOUT a Weakness
// token, the deployed side has no such restriction and can stack a second one.

const HEMLOCK = Cards.leaders.hmw.doctorHemlock;
const WEAKNESS = "HMW_T02";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground
const ONE_HP = "HMW_196";                           // Qimir — 3/1 Ground

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP) // Vigilance
    .MyLeader(HEMLOCK)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

const weaknessCount = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === WEAKNESS).length;

describe("HMW_003 Doctor Hemlock — Emotion Has No Place Here", () => {
  describe("leader side — Action [1 resource, Exhaust]", () => {
    it("gives a Weakness token, and the unit is −1/−1", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      const target = g.state.player2.groundArena[0];
      expect(weaknessCount(target)).toBe(1);
      expect(Unit.FromInterface(target).CurrentPower()).toBe(2); // 3 - 1
      expect(Unit.FromInterface(target).TotalHP()).toBe(6);      // 7 - 1
      expect(g.state.player1.resources.filter(r => r.ready).length).toBe(7);
      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("can target a FRIENDLY unit — 'a unit' is unqualified", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).Build());

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(weaknessCount(g.state.player1.groundArena[0])).toBe(1);
    });

    it("cannot target a unit that ALREADY has a Weakness token", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(2, CSF)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [
            { cardId: WEAKNESS, playId: "@", owner: 2, controller: 2 },
          ])
          .WithGroundUnitForPlayer(2, MARINE) // the only legal target
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0); // the already-weakened CSF

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(weaknessCount(g.state.player2.groundArena[0])).toBe(1); // still just the one
    });

    it("is unavailable when every unit already has a Weakness token", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(2, CSF)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [
            { cardId: WEAKNESS, playId: "@", owner: 2, controller: 2 },
          ])
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
    });

    it("is unavailable without a resource", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(0).WithGroundUnitForPlayer(2, CSF).Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });

    it("the −1 HP is LETHAL to a 1-HP unit", async () => {
      // Nothing else in the engine lowers HP by ATTACHING an upgrade, so the attach must sweep.
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, ONE_HP).Build());

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player2.discard.map(c => c.cardId)).toContain(ONE_HP);
    });
  });

  describe("deployed side — On Attack: you may give a Weakness token", () => {
    async function deployAndAttack(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.Build());
      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === HEMLOCK);
      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);
      return g;
    }

    it("accepting gives a Weakness token to the chosen unit", async () => {
      const g = await deployAndAttack(setup().WithGroundUnitForPlayer(2, CSF));

      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(weaknessCount(g.state.player2.groundArena[0])).toBe(1);
      expect(g.state.player2.base.damage).toBe(3); // the attack still landed
    });

    it("declining gives nothing", async () => {
      const g = await deployAndAttack(setup().WithGroundUnitForPlayer(2, CSF));

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(weaknessCount(g.state.player2.groundArena[0])).toBe(0);
      expect(g.state.player2.base.damage).toBe(3);
    });

    it("CAN stack a second token — the deployed side has no 'without' restriction", async () => {
      const g = await deployAndAttack(
        setup()
          .WithGroundUnitForPlayer(2, CSF)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [
            { cardId: WEAKNESS, playId: "@", owner: 2, controller: 2 },
          ]),
      );

      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      const target = g.state.player2.groundArena[0];
      expect(weaknessCount(target)).toBe(2);
      expect(Unit.FromInterface(target).CurrentPower()).toBe(1); // 3 - 2
      expect(Unit.FromInterface(target).TotalHP()).toBe(5);      // 7 - 2
    });

    it("can target HIMSELF — once deployed he is a unit, and 'a unit' is unqualified", async () => {
      // So the prompt always has at least one legal target on the deployed side.
      const g = await deployAndAttack(setup());

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);
      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === HEMLOCK);
      await g.chooseGroundUnitAsync(1, idx);

      const hemlock = g.state.player1.groundArena.find(u => u.cardId === HEMLOCK)!;
      expect(weaknessCount(hemlock)).toBe(1);
      expect(Unit.FromInterface(hemlock).TotalHP()).toBe(5); // 6 - 1
    });
  });

  it("Epic Action: deploys at 6 resources, spending none", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(6);
  });
});
