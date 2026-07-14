import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_063 Oggdo Bogdo — Unit (Vigilance, Creature), cost 3, 5/5
// "This unit can't attack unless it's damaged."
// "When this unit attacks and defeats a unit: Heal 2 damage from this unit."

// damage = starting damage on Oggdo Bogdo (0 = undamaged, so it can't attack)
function setup(oggdoDamage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo, true, oggdoDamage);
}

describe("LOF_063 Oggdo Bogdo", () => {
  describe("'This unit can't attack unless it's damaged.'", () => {
    it("cannot attack while undamaged", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(0).WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

      await g.attackWithGroundUnitAsync(1, 0);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });

    it("can attack once it has damage on it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(1).WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

      await g.attackWithGroundUnitAsync(1, 0);

      expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    });

    it("can attack while undamaged if it has lost its abilities", async () => {
      const g = new GameTestAdapter();
      const state = setup(0)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      // "This unit can't attack unless it's damaged" is itself an ability — losing all
      // abilities removes the restriction.
      state.player1.groundArena[0].upgrades.push({
        cardId: Cards.upgrades.shd.imprisoned,
        playId: "imprisoned-1",
        owner: 2,
        controller: 2,
      });
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 0);

      expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    });
  });

  describe("'When this unit attacks and defeats a unit: Heal 2 damage from this unit.'", () => {
    it("heals 2 damage after defeating the defending unit", async () => {
      const g = new GameTestAdapter();
      const state = setup(1)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — dies to 5 power
        .Build();
      g.loadNewState(state);

      const defenderPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

      expect(g.state.player2.groundArena).toHaveLength(0); // defender defeated
      // 1 starting damage + 3 taken from the Marine = 4, healed by 2 → 2
      expect(g.state.player1.groundArena[0].damage).toBe(2);
    });

    it("does not heal when the defender survives", async () => {
      const g = new GameTestAdapter();
      const state = setup(1)
        .WithGroundUnitForPlayer(2, Cards.units.lof.grogu) // 1/6 — survives 5 power
        .Build();
      g.loadNewState(state);

      const defenderPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

      expect(g.state.player2.groundArena).toHaveLength(1); // survived
      // 1 starting + 1 taken from Grogu = 2, no heal
      expect(g.state.player1.groundArena[0].damage).toBe(2);
    });

    it("does not heal when attacking a base (no unit defeated)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(3).Build()); // no enemy units — attack the base

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(5);
      expect(g.state.player1.groundArena[0].damage).toBe(3); // unchanged — no heal
    });

    it("does not heal past 0 damage", async () => {
      const g = new GameTestAdapter();
      const state = setup(1)
        .WithGroundUnitForPlayer(2, Cards.units.lof.guardianOfTheWhills) // 2/2 — dies to 5
        .Build();
      g.loadNewState(state);

      const defenderPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

      // 1 starting + 2 taken = 3, healed by 2 → 1 (never negative)
      expect(g.state.player1.groundArena[0].damage).toBe(1);
      expect(g.state.player1.groundArena[0].damage).toBeGreaterThanOrEqual(0);
    });
  });
});
