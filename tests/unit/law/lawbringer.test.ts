import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LAW_101 Lawbringer (7/7 Space) —
// "When Played/On Attack: Choose an aspect. Give each enemy unit with that aspect –2/–2 for this phase."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

// Battlefield Marine (SOR_095) is Command/Heroism; Vigilant Honor Guards (SOR_048) is Vigilance/Heroism.
describe("LAW_101 Lawbringer", () => {
  it("When Played: gives –2/–2 to each enemy unit with the chosen aspect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.lawbringer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)      // Command 3/3
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)    // Vigilance/Heroism 4/6
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["Command"] });

    const marine = Unit.FromInterface(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!);
    const guards = Unit.FromInterface(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.vigilantHonorGuards)!);
    expect(marine.CurrentPower()).toBe(1); // 3 – 2 (Command)
    expect(marine.TotalHP()).toBe(1);      // 3 – 2
    expect(guards.CurrentPower()).toBe(4); // no Command, untouched
  });

  it("only affects enemy units, not friendly ones with the aspect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.lawbringer)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // friendly Command
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // enemy Command
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["Command"] });

    const friendly = Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!);
    const enemy = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(friendly.CurrentPower()).toBe(3); // untouched
    expect(enemy.CurrentPower()).toBe(1);    // debuffed
  });

  it("On Attack: also fires the aspect debuff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.law.lawbringer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // Command enemy
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // choose the attack target first
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["Command"] }); // then the On Attack aspect

    const enemy = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(enemy.CurrentPower()).toBe(1); // 3 – 2
  });
});
