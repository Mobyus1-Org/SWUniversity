import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_051 Mystic Reflection (Event, cost 1) —
//   "Give an enemy unit –2/–0 for this phase. If you control a Force unit, give the enemy unit
//    –2/–2 for this phase instead."
describe("SHD_051 Mystic Reflection", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("without a friendly Force unit: gives the enemy unit -2/-0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel/Trooper — NOT Force
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 victim
        .WithCardInHandForPlayer(1, Cards.events.shd.mysticReflection)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const victim = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(victim.CurrentPower()).toBe(1); // 3 - 2
    expect(victim.TotalHP()).toBe(3);      // HP untouched
  });

  it("with a friendly Force unit: gives the enemy unit -2/-2 instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.yoda)              // Force trait
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 victim
        .WithCardInHandForPlayer(1, Cards.events.shd.mysticReflection)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const victim = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(victim.CurrentPower()).toBe(1); // 3 - 2
    expect(victim.TotalHP()).toBe(1);      // 3 - 2 — the "instead" branch
  });

  it("the -2/-2 branch defeats an enemy unit whose damage now exceeds its reduced HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.yoda)                    // Force trait
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2) // 3/3 with 2 damage
        .WithCardInHandForPlayer(1, Cards.events.shd.mysticReflection)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // HP drops to 1, which is below its 2 existing damage → swept.
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("cannot target a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.mysticReflection)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // try to debuff my own Marine

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });
});
