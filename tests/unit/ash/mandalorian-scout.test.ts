import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_216 Mandalorian Scout (3/3 Ground, cost 2)
// "When Defeated: Exhaust a ready friendly resource."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_216 Mandalorian Scout", () => {
  it("exhausts one of its controller's ready resources when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3 power kills its 3 HP
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.resources.filter(r => !r.ready)).toHaveLength(1);
  });

  it("exhausts its CONTROLLER's resource, not the opponent's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.resources.filter(r => !r.ready)).toHaveLength(0);
  });

  it("does nothing when its controller has no ready resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, false) // all exhausted
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.resources.filter(r => !r.ready)).toHaveLength(3); // unchanged
  });
});
