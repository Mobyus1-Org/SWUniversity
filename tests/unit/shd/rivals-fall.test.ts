import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_079 Rival's Fall — cost 6 Vigilance event. "Defeat a unit."
// No restriction at all: either side, leaders included, any HP.

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall);
}

describe("SHD_079 Rival's Fall", () => {
  it("defeats a chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(Cards.units.sor.gamorreanGuards);
  });

  it("defeats an enemy LEADER unit ('a unit', unrestricted)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("can defeat a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("defeats regardless of remaining HP (a defeat, not damage)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build()); // 4/10

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("fires the defeated unit's When Defeated ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(2, Cards.units.sor.superlaserTechnician).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Superlaser Technician's owner is asked whether to resource it.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("cannot defeat an enemy unit piloted by Chewbacca (JTL_103)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // no other legal target
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("cannot defeat an enemy Chewbacca (JTL_103) as a unit either", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.jtl.chewbacca).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("CAN defeat your OWN Chewbacca-piloted unit (immunity is to ENEMY abilities)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 1)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
  });

  it("does not prompt when there is no unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
