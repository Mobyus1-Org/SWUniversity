import { describe, expect, it } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Overwhelm", () => {
  it("deals excess damage to the opponent's base", async () => {
    // arrange
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    const g = new GameTestAdapter();
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("does not spill excess to the base when a Shield token absorbs the attack", async () => {
    // A Shield token absorbs the entire damage instance, so the defender takes no
    // combat damage and is not defeated — Overwhelm has no excess to deal.
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa) // 4 power, Overwhelm
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2),
      ])
      .Build()
    ;
    const g = new GameTestAdapter();
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player2.groundArena.length).toBe(1);           // marine survives
    expect(g.state.player2.groundArena[0].damage).toBe(0);        // shield absorbed all damage
    expect(g.state.player2.groundArena[0].upgrades.length).toBe(0); // shield token consumed
    expect(g.state.player2.base.damage).toBe(0);                  // no Overwhelm excess
  });
});