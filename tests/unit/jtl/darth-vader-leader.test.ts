import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

const TIE_TOKEN = "JTL_T01";

// JTL_006 Darth Vader - Victor Squadron Leader (Leader, deploy 6; 5/6 unit, +5/+5 as a pilot) —
//   Front: "Action [Exhaust]: If you attacked with a non-token Vehicle unit this phase,
//           create a TIE Fighter token.
//           Epic Action: If you control 6 or more resources, choose one:
//           Deploy this leader. / Deploy this leader as an upgrade on a friendly Vehicle unit
//           without a Pilot on it."
//   Deployed: "Attached unit is a leader unit.
//              When deployed as an upgrade: Create 2 TIE Fighter tokens."
describe("JTL_006 Darth Vader - Victor Squadron Leader", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.jtl.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const ties = (g: GameTestAdapter) =>
    [...g.state.player1.spaceArena, ...g.state.player1.groundArena].filter(u => u.cardId === TIE_TOKEN).length;

  describe("front Action: create a TIE Fighter", () => {
    it("creates a TIE after a non-token Vehicle attacked this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter) // a real Vehicle card
          .Build(),
      );

      await g.attackWithSpaceUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);

      expect(ties(g)).toBe(1);
      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("soft-passes when no Vehicle attacked this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Vehicle
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);

      expect(ties(g)).toBe(0);
    });

    it("a TOKEN Vehicle attacking does not satisfy the condition", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, TIE_TOKEN) // a TIE Fighter token
          .Build(),
      );

      await g.attackWithSpaceUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);

      expect(ties(g)).toBe(1); // still just the original token — no new one
    });

    it("control: with no attack at all, nothing is created", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14).Build(),
      );

      await g.useLeaderAbilityAsync(1);

      expect(ties(g)).toBe(0);
    });
  });

  describe("Epic Action: deploy as unit or as a Pilot upgrade", () => {
    it("offers the choice while a pilotless friendly Vehicle is out", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      expect(g.lastDispatchResponse?.resolutionNeeded).toMatchObject({
        options: ["Deploy as Unit", "Deploy as Pilot"],
      });
    });

    it("deploying as a Pilot upgrade creates 2 TIE Fighter tokens", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .Build(),
      );

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "Deploy as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);

      expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.leaders.jtl.darthVader)).toBe(true);
      expect(ties(g)).toBe(2);
    });

    it("deploying as a UNIT creates no TIE tokens", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .Build(),
      );

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "Deploy as Unit");

      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.darthVader)).toBe(true);
      expect(ties(g)).toBe(0);
    });

    it("the host becomes a leader unit while he is attached", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .Build(),
      );

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "Deploy as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);

      const { Unit } = await import("@/server/engine/unit");
      expect(Unit.FromInterface(g.state.player1.spaceArena[0]).IsLeader()).toBe(true);
    });

    it("with no eligible Vehicle he simply deploys as a unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14).Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.darthVader)).toBe(true);
      expect(ties(g)).toBe(0);
    });
  });
});
