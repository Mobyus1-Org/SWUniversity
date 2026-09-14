import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_132 First Order Stormtrooper (2/1 Ground, cost 1, Aggression/Villainy)
//   "On Attack/When Defeated: Deal 1 indirect damage to a player. (They assign 1 unpreventable
//    damage among their base and units.)"

const TROOPER = Cards.units.jtl.firstOrderStormtrooper;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithActivePlayer(1);
}

describe("JTL_132 First Order Stormtrooper", () => {
  describe("On Attack", () => {
    it("offers the player choice, then the attack still resolves", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, TROOPER).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      const res = g.lastDispatchResponse?.resolutionNeeded;
      expect(res?.type === "Option" && res.options).toContain("Opponent");
      expect(res?.type === "Option" && res.options).toContain("Yourself");

      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

      // 2 combat + 1 indirect auto-assigned to the base (the opponent has no units).
      expect(g.state.player2.base.damage).toBe(3);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });

    it("the victim assigns the damage among their units and base — Shields don't stop it", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithGroundUnitForPlayer(1, TROOPER)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
        .Build();
      g.loadNewState(s);

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [{ playId: s.player2.groundArena[0].playId, damage: 1 }],
      });

      const security = g.state.player2.groundArena[0];
      expect(security.damage).toBe(1);
      expect(security.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield]);
      expect(g.state.player2.base.damage).toBe(2); // combat damage only
    });

    it("may be aimed at yourself", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, TROOPER).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(1, "choose-option", { option: "Yourself" });
      // The trooper is my only unit, so I must assign the 1 myself (unit or base).
      await g.dispatchAsync(1, "choose-target", {
        spreadDamageAssignments: [{ playId: "player1.base", damage: 1 }],
      });

      expect(g.state.player1.base.damage).toBe(1);
      expect(g.state.player2.base.damage).toBe(2);
    });
  });

  describe("When Defeated", () => {
    it("dying as the defender still deals 1 indirect damage, and the attack finishes", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, TROOPER)
        .WithGroundUnitForPlayer(2, Cards.units.sor.wampa) // 4/5
        .Build());

      await g.attackWithGroundUnitAsync(2, 0);
      await g.chooseGroundUnitAsync(1, 0); // attack the trooper

      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      // P2's Wampa (4/5, took 2) is P2's only unit, so P2 assigns the 1.
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [{ playId: "player2.base", damage: 1 }],
      });

      expect(g.state.player1.groundArena).toHaveLength(0); // trooper died
      expect(g.state.player2.groundArena[0].damage).toBe(2); // its combat damage landed
      expect(g.state.player2.base.damage).toBe(1);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });

    it("defeated by an event also deals the indirect damage", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base()
        .WithGroundUnitForPlayer(1, TROOPER)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

      expect(g.state.player2.base.damage).toBe(1);
    });
  });

  it("control: an ordinary unit attacking deals no indirect damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
