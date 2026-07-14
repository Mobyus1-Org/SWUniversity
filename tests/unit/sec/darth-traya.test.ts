import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_188 Darth Traya — Lord of Betrayal (2/5 Ground, Force/Sith, cost 3)
// "On Attack: You may ready a non-unit leader."
// ("non-unit leader" = a leader still in the leader zone, i.e. not deployed as a unit.)

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    // Leader starts EXHAUSTED so readying it is observable.
    .MyLeader(Cards.leaders.sor.grandMoffTarkin, false)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren, false)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithGroundUnitForPlayer(1, Cards.units.sec.darthTraya);
}

describe("SEC_188 Darth Traya", () => {
  it("On Attack: readies your own exhausted leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    expect(g.state.player1.leader.ready).toBe(false);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseLeaderAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("can ready the OPPONENT's leader ('a non-unit leader', either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Leader"], targetPlayers: [2] });

    expect(g.state.player2.leader.ready).toBe(true);
    expect(g.state.player1.leader.ready).toBe(false); // yours untouched
  });

  it("declining readies nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player2.leader.ready).toBe(false);
  });

  it("a DEPLOYED leader is not a legal target ('non-unit leader')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin, false, true) // deployed → a unit, not eligible
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false, true) // also deployed
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithGroundUnitForPlayer(1, Cards.units.sec.darthTraya)
        .Build(),
    );

    const attacked = await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Both leaders are deployed, so there is no legal target and no prompt.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(attacked).toBeDefined();
  });

  it("no prompt when every non-unit leader is already ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin, true) // ready
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, true) // ready
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithGroundUnitForPlayer(1, Cards.units.sec.darthTraya)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
