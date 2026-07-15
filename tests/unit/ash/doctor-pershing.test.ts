import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_072 Doctor Pershing (0/4 Ground, cost 2)
// "Support (…)"
// "On Attack: If this unit has 3 or more remaining HP, draw a card."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
}

describe("ASH_072 Doctor Pershing", () => {
  it("On Attack: draws a card at 3 or more remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.doctorPershing, true, 1).Build()); // 4 HP – 1 = 3
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });

  it("draws nothing below 3 remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.doctorPershing, true, 2).Build()); // 4 – 2 = 2
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("Support grants the On Attack — the supported attacker draws instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3, undamaged → 3 HP
        .WithCardInHandForPlayer(1, Cards.units.ash.doctorPershing)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0); // hand –1
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1); // played one, drew one
  });
});
