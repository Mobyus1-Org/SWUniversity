import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_009 Chewbacca — Relentless Rebel (Leader; deployed 3/6 Ground, Rebel/Wookiee)
//   Leader:   "Action [2 resources, Exhaust]: Attack with a unit, even if it's exhausted.
//              It can't attack bases for this attack."
//              "Epic Action: If you control 5 or more resources, deploy this leader."
//   Deployed: "Action: Attack with a unit, even if it's exhausted. It can't attack bases for this
//              attack. Use this ability only once each round."
//
// Both sides are the same effect on different terms: the leader side costs 2 resources and the
// leader's exhaust, the deployed side is free but limited to once a round. "Even if it's
// exhausted" is the whole point — the ready filter that every other attack-with ability uses must
// NOT apply here. The base restriction rides on the established `<cardId>_no_base` ForAttack
// effect, so it expires with the attack rather than lingering on the unit.

const CHEWIE = Cards.leaders.hmw.chewbacca;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground — survives to be hit twice

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(CHEWIE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

const readyResources = (g: GameTestAdapter) =>
  g.state.player1.resources.filter(r => r.ready).length;

describe("HMW_009 Chewbacca — Relentless Rebel", () => {
  describe("leader side — Action [2 resources, Exhaust]", () => {
    it("attacks with a READY unit, costing 2 and exhausting the leader", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);   // attack with the Marine
      await g.chooseGroundUnitAsync(2, 0);   // into the enemy CSF

      expect(g.state.player2.groundArena[0].damage).toBe(3);
      expect(readyResources(g)).toBe(6);          // 8 - 2
      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("attacks with an EXHAUSTED unit — the clause that makes this card", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE, false) // already exhausted
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("cannot attack a base — Base is not offered and choosing it is rejected", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      const resolution = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
      expect(resolution.fromZones ?? []).not.toContain("Base");

      const result = await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });
      expect(result.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player2.base.damage).toBe(0);
    });

    it("the base restriction expires with the attack", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)      // used by the ability
          .WithGroundUnitForPlayer(1, CSF)         // attacks the base normally afterwards
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "pass-action", {});

      // A different unit's ordinary attack can still hit the base. Found by cardId: the Marine
      // died to the 3/7's counter-damage, so a fixed index would point at the wrong unit.
      const csfIndex = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
      await g.attackWithGroundUnitAsync(1, csfIndex);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(3);
    });

    it("cannot choose an ENEMY unit — 'attack with' means your own", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      const enemy = g.state.player2.groundArena[0].playId;
      const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });

      expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    });

    it("is unavailable without 2 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(1)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
    });

    it("is unavailable with no friendly unit to attack with", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });

  describe("deployed side — free, once each round", () => {
    /** Deploys Chewbacca (Epic Action needs 5+ resources) and hands the turn back. */
    async function deployed(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.Build());
      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      return g;
    }

    it("attacks with an exhausted unit for free, without exhausting Chewbacca", async () => {
      const g = await deployed(
        setup()
          .WithGroundUnitForPlayer(1, MARINE, false) // exhausted
          .WithGroundUnitForPlayer(2, CSF),
      );
      const before = readyResources(g);
      const chewiePlayId = g.state.player1.groundArena.find(u => u.cardId === CHEWIE)!.playId;

      await g.dispatchAsync(1, "use-ability", { playId: chewiePlayId });
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(3);
      expect(readyResources(g)).toBe(before); // free — no resource cost
      const chewie = g.state.player1.groundArena.find(u => u.cardId === CHEWIE)!;
      expect(chewie.ready).toBe(true);        // a plain "Action:", no Exhaust in the cost
    });

    it("can be used only ONCE each round", async () => {
      const g = await deployed(
        setup()
          .WithGroundUnitForPlayer(1, MARINE, false)
          .WithGroundUnitForPlayer(2, CSF),
      );

      const chewiePlayId = g.state.player1.groundArena.find(u => u.cardId === CHEWIE)!.playId;
      await g.dispatchAsync(1, "use-ability", { playId: chewiePlayId });
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "pass-action", {});

      await g.dispatchAsync(1, "use-ability", { playId: chewiePlayId }); // second use, same round

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player2.groundArena[0].damage).toBe(3); // still just the one attack
    });
  });

  it("Epic Action: deploys at 5 resources, spending none", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(readyResources(g)).toBe(5);
  });

  it("Epic Action: cannot deploy on 4 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4).Build());

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.deployed).toBe(false);
  });
});
