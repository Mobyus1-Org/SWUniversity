import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("SOR_092 Overwhelming Barrage", () => {
  it("gives +2/+2 to chosen unit and spreads its power among all other units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // provides Command+Villainy for SOR_092
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 → becomes 5/5 with +2/+2
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // target of spread
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // target of spread
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.overwhelmingBarrage)
      .Build();
    g.loadNewState(state);

    const chosenPlayId = state.player1.groundArena[0].playId;
    const enemy0 = state.player2.groundArena[0].playId;
    const enemy1 = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    // Choose the friendly marine as the unit to buff
    await g.chooseGroundUnitAsync(1, 0);

    // Now distribute 5 damage (buffed power: 3 + 2 = 5) among other units
    // enemy0 gets 3, enemy1 gets 2
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: enemy0, damage: 3 },
        { playId: enemy1, damage: 2 },
      ],
    });

    // Marines have 3 HP — enemy0 gets 3 dmg (defeated), enemy1 gets 2 dmg (survives)
    expect(g.state.player2.groundArena.find(u => u.playId === enemy0)).toBeUndefined();
    expect(g.state.player2.groundArena.find(u => u.playId === enemy1)).toBeDefined();
    expect(g.state.player2.groundArena.find(u => u.playId === enemy1)!.damage).toBe(2);
  });
});
