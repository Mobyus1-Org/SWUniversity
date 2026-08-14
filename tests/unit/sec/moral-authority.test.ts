import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";
import { Unit } from "@/server/engine/unit";

// SEC_256 Moral Authority — Upgrade (Heroism, Innate), cost 3, +2/+0.
// "Attach to a friendly <uq> (unique) unit."
// "When Played: Attached unit captures an enemy non-leader unit with less remaining HP than it."
//
// The comparison is on REMAINING HP (total HP minus damage) and is strict — an equal-HP unit is
// not a legal victim. Moral Authority is +2/+0, so attaching it never moves the host's own
// remaining HP. The printed text carries no arena restriction, unlike Take Captive's "in the
// same arena", so a ground host may capture a space unit.

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.upgrades.sec.moralAuthority);
}

describe("SEC_256 Moral Authority", () => {
  describe("attach restriction — 'Attach to a friendly unique unit.'", () => {
    it("offers friendly unique units only", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // 2/5, unique
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // not unique
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // unique, but enemy
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).toContain(state.player1.groundArena[0].playId);
      expect(targets).not.toContain(state.player1.groundArena[1].playId);
      expect(targets).not.toContain(state.player2.groundArena[0].playId);
    });

    it("gives the host +2/+0", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // 2/5
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      const host = Unit.FromInterface(g.state.player1.groundArena[0]);
      expect(host.upgrades.map(u => u.cardId)).toContain(Cards.upgrades.sec.moralAuthority);
      expect(host.CurrentPower()).toBe(4); // 2 + 2
      expect(host.TotalHP()).toBe(5);      // HP untouched
    });
  });

  describe("'When Played: Attached unit captures an enemy non-leader unit with less remaining HP than it.'", () => {
    it("captures the chosen lower-HP enemy unit — it leaves the arena and sits under the host", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // 2/5 → 5 remaining HP
        .WithGroundUnitForPlayer(2, Cards.units.sec.imperialOccupier) // 2/2 → 2 remaining
        .Build();
      g.loadNewState(state);

      const victimPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0); // attach to Gungi
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victimPlayId] });

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player1.groundArena[0].captives.map(c => c.cardId))
        .toEqual([Cards.units.sec.imperialOccupier]);
    });

    it("does not offer an enemy unit with equal or greater remaining HP", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // 5 remaining
        .WithGroundUnitForPlayer(2, Cards.units.sec.imperialOccupier) // 2 remaining — eligible
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 2) // 3/7, 5 remaining — tied
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // 8 remaining — bigger
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).toEqual([state.player2.groundArena[0].playId]);
    });

    it("counts damage — a big enemy unit becomes capturable once damaged below the host", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // 5 remaining
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 3) // 3/7 with 3 → 4 remaining
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
    });

    it("control — damage on the HOST can drop it below an enemy, leaving nothing to capture", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseState()
          .WithGroundUnitForPlayer(1, Cards.units.lof.gungi, true, 3) // 2/5 with 3 → 2 remaining
          .WithGroundUnitForPlayer(2, Cards.units.sec.imperialOccupier) // 2 remaining — not LESS
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player2.groundArena).toHaveLength(1);
      expect(g.state.player1.groundArena[0].captives).toHaveLength(0);
    });

    it("never offers an enemy leader unit", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true, true)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // deployed enemy leader
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(2, Cards.units.sec.imperialOccupier)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).toEqual([state.player2.groundArena[1].playId]);
    });

    it("can capture across arenas — the text has no same-arena clause", async () => {
      const g = new GameTestAdapter();
      const state = baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // ground host, 5 remaining
        .WithSpaceUnitForPlayer(2, Cards.units.sec.contrabandStarhopper) // 2/3 space
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      expect(TargetIds(g)).toEqual([state.player2.spaceArena[0].playId]);

      await g.chooseSpaceUnitAsync(2, 0);
      expect(g.state.player2.spaceArena).toHaveLength(0);
      expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
    });

    it("the capture is mandatory — a target prompt is raised, not a skippable option", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseState()
          .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
          .WithGroundUnitForPlayer(2, Cards.units.sec.imperialOccupier)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    });

    it("strips the captive's damage and upgrades while it is held", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseState()
          .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // 5 remaining
          .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 3) // 3/7 with 3 → 4 remaining
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [
            // A Shield token is stat-neutral, so it can't move the victim's remaining HP.
            { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2, controller: 2 },
          ])
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      const captive = g.state.player1.groundArena[0].captives[0];
      expect(captive.damage).toBe(0);
      expect(captive.upgrades).toHaveLength(0);
    });
  });
});
