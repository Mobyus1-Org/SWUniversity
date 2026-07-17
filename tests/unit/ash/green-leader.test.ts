import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_153 Green Leader (1/3 Space, cost 2) — "When Defeated: You may deal 2 damage to a unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2);
}

describe("ASH_153 Green Leader — When Defeated", () => {
  it("may deal 2 damage to a chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.greenLeader) // 1/3 — will be defeated
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 attacker
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // damage target
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0); // attack Green Leader

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.ash.greenLeader)).toBe(false); // defeated

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.damage).toBe(2);
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.greenLeader)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseNoAsync(1);

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.damage).toBe(0);
  });
});
