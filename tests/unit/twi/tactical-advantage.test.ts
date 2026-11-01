import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_124 Tactical Advantage (Event, cost 1, Command) — reprint of SOR_124.
//   "Give a unit +2/+2 for this phase."

function load() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.twi.tacticalAdvantage)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
      .Build(),
  );
  return g;
}

describe("TWI_124 Tactical Advantage", () => {
  it("gives a friendly unit +2/+2 for this phase", async () => {
    const g = load();
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseGroundUnitAsync(1, 0);

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(5);
    expect(unit.TotalHP()).toBe(5);
  });

  it("can target an enemy unit — 'a unit'", async () => {
    const g = load();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const enemy = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(enemy.CurrentPower()).toBe(5);
    expect(enemy.TotalHP()).toBe(9);
    // The friendly unit is untouched (control).
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });
});
