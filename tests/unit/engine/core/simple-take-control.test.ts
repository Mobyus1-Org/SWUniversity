import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { CommonSetup } from "../../../test-helpers";

function traitorousSetup() {
  return CommonSetup(new GameStateBuilder(), "grw", "grw", {
    my: { resourceCount: 5, handCardIds: [Cards.upgrades.sor.traitorous] },
    their: {},
  })
}

function changeOfHeartSetup() {
  return CommonSetup(new GameStateBuilder(), "yrw", "yrw", {
    my: { resourceCount: 6, handCardIds: [Cards.events.sor.changeOfHeart] },
    their: {},
  })
}

describe("Take Control — Traitorous (SOR_122)", () => {
  it("attaching to cheap enemy ground unit takes control", async () => {
    // Battlefield Marine: cost 2, ground, 3 HP / 2 power
    const g = new GameTestAdapter();
    g.loadNewState(
      traitorousSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    // Engine now has upgrade-target pending: P2's marine should be eligible
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    const marine = g.state.player1.groundArena[0];
    expect(marine.cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(marine.controller).toBe(1);
    expect(marine.owner).toBe(2);
    expect(marine.upgrades).toHaveLength(1);
    expect(marine.upgrades[0].cardId).toBe(Cards.upgrades.sor.traitorous);
  });

  it("attaching to cheap enemy space unit takes control", async () => {
    // X-Wing token (JTL_T02): cost 2, space, Vehicle
    const g = new GameTestAdapter();
    g.loadNewState(
      traitorousSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const xWingPlayId = g.state.player2.spaceArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [xWingPlayId] });

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player1.spaceArena).toHaveLength(1);
    const xWing = g.state.player1.spaceArena[0];
    expect(xWing.cardId).toBe(Cards.units.token.xWing);
    expect(xWing.controller).toBe(1);
    expect(xWing.owner).toBe(2);
  });

  it("unit with a leader pilot is not eligible for Traitorous", async () => {
    // P2 has two marines: one plain, one with a leader upgrade (simulating leader-pilot "Leader unit" status).
    // Only the plain marine should appear in fromPlayIds.
    const g = new GameTestAdapter();
    g.loadNewState(
      traitorousSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // eligible
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // will have leader upgrade
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [
          GameStateBuilder.Upgrade(Cards.leaders.jtl.darthVader, 2),
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");

    const eligiblePlayId = g.state.player2.groundArena[0].playId;
    const leaderPilotUnitPlayId = g.state.player2.groundArena[1].playId;

    if (resolution?.type === "Target") {
      expect(resolution.fromPlayIds).toContain(eligiblePlayId);
      expect(resolution.fromPlayIds).not.toContain(leaderPilotUnitPlayId);
    }
  });

  it("Confiscate removes Traitorous and owner regains control", async () => {
    // Law aspect is not covered by standard bases → Confiscate costs 1 + 2 = 3 for P2.
    const g = new GameTestAdapter();
    g.loadNewState(
      traitorousSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3) // 3 ready for Confiscate
        .WithCardInHandForPlayer(2, Cards.events.sor.confiscate)
        .Build(),
    );

    // P1 plays Traitorous → marine moves to P1's arena
    await g.playCardFromHandAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].controller).toBe(1);
    expect(g.state.player1.groundArena[0].owner).toBe(2);

    // P2 plays Confiscate targeting the Traitorous upgrade on the marine (now in P1's arena)
    await g.playCardFromHandAsync(2, 0);
    // choose-target: Traitorous upgrade on P1's groundArena[0].upgrades[0]
    await g.chooseUpgradeOnGroundUnitAsync(2, 1, 0, 0);

    // Marine should be back in P2's arena, controller = 2
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(1);
    const marine = g.state.player2.groundArena[0];
    expect(marine.controller).toBe(2);
    expect(marine.owner).toBe(2);
    expect(marine.upgrades).toHaveLength(0); // Traitorous was defeated
  });
});

describe("Take Control — Change of Heart (SOR_224)", () => {
  it("takes control of a non-ready unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      changeOfHeartSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false) // not ready
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    const marine = g.state.player1.groundArena[0];
    expect(marine.controller).toBe(1);
    expect(marine.owner).toBe(2);
    expect(marine.ready).toBe(false);
  });

  it("takes control of a ready unit and attacks with it", async () => {
    // P2's marine is ready (3 power). P1 takes control, P2 passes, P1 attacks P2's base.
    const g = new GameTestAdapter();
    g.loadNewState(
      changeOfHeartSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true) // ready
        .Build(),
    );

    // P1 plays Change of Heart → marine moves to P1's ground arena, still ready
    await g.playCardFromHandAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player1.groundArena[0].ready).toBe(true);

    // P2 passes → P1's turn
    await g.dispatchAsync(2, "pass-action", {});

    // P1 attacks P2's base with the taken marine (2 power)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("owner regains control at the start of the regroup phase (before cards are drawn)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      changeOfHeartSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    // P1 plays Change of Heart → marine to P1's arena
    await g.playCardFromHandAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    expect(g.state.player1.groundArena).toHaveLength(1);

    // P2 passes action (now P1's turn again; lastActionWasPass = false → false)
    await g.dispatchAsync(2, "pass-action", {});
    // P1 passes → two consecutive passes → triggers regroup phase
    // executeRegroupDraw fires: reverts CoH effect before drawing
    await g.dispatchAsync(1, "pass-action", {});

    // Marine should now be back in P2's arena
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(1);
    const marine = g.state.player2.groundArena[0];
    expect(marine.controller).toBe(2);
    expect(marine.owner).toBe(2);
    // Game is now in the regroup resource step
    expect(g.state.gamePhase).toBe("RegroupResource");
  });
});
