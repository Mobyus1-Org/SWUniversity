import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// ASH_240 Mandalorian Super Commandos (2/5 Ground, cost 3)
// "While you control a leader unit, this unit gets +2/+0."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.ash.ahsokaTano)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_240 Mandalorian Super Commandos", () => {
  it("gets +2/+0 while its controller has a leader unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano) // the deployed leader unit
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianSuperCommandos)
        .Build(),
    );

    const commandos = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.mandalorianSuperCommandos)!;
    expect(Unit.FromInterface(commandos).CurrentPower()).toBe(4); // 2 base + 2
  });

  it("is just 2 power with no leader unit in play (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianSuperCommandos)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2);
  });

  it("is not buffed by an ENEMY leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianSuperCommandos)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2);
  });
});
