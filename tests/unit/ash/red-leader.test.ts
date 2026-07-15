import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_037 Red Leader (6/6 Space, cost 7)
// "Support (…)"
// "This unit may attack units in either arena."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_037 Red Leader", () => {
  it("a space unit, can attack an enemy GROUND unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.redLeader)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 6 power killed the 3/3
  });

  it("an ordinary space unit cannot", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const attacked = await g.attackWithSpaceUnitAsync(1, 0);
    const resolution = attacked.lastDispatchResponse?.resolutionNeeded;
    const offered = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];

    expect(offered).not.toContain(g.state.player2.groundArena[0].playId);
  });

  it("Support grants the reach — a supported GROUND unit can hit a space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
        .WithCardInHandForPlayer(1, Cards.units.ash.redLeader)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // the ground Marine attacks…
    await g.chooseSpaceUnitAsync(2, 0);  // …an enemy SPACE unit

    expect(g.state.player2.spaceArena).toHaveLength(0);
  });
});
