import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_142 Anakin's Interceptor — 2/3 Space (Vehicle)
// "While your base has 15 or more damage on it, this unit gets +2/+0."

function buildWithBaseDamage(damage: number): GameTestAdapter {
  const g = new GameTestAdapter();
  const state = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, damage)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.twi.anakinsInterceptor)
    .Build();
  g.loadNewState(state);
  return g;
}

describe("TWI_142 Anakin's Interceptor", () => {
  it("has base power 2 while your base has fewer than 15 damage", async () => {
    const g = buildWithBaseDamage(14);
    const interceptor = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(interceptor.CurrentPower()).toBe(2);
  });

  it("gets +2/+0 while your base has 15 or more damage", async () => {
    const g = buildWithBaseDamage(15);
    const interceptor = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(interceptor.CurrentPower()).toBe(4);
    expect(interceptor.CurrentHP()).toBe(3); // HP unaffected (+2/+0)
  });
});
