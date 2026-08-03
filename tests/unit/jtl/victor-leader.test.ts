import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_085 Victor Leader - Leading from the Front (2/4 Space, cost 3) —
//   "Each other friendly space unit gets +1/+1."
describe("JTL_085 Victor Leader - Leading from the Front", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gives each other friendly SPACE unit +1/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter) // 2/1
        .Build(),
    );

    const tie = Unit.FromInterface(g.state.player1.spaceArena[1]);
    expect(tie.CurrentPower()).toBe(3); // 2 + 1
    expect(tie.TotalHP()).toBe(2);      // 1 + 1
  });

  it("does NOT buff itself ('each OTHER friendly space unit')", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    const vl = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(vl.CurrentPower()).toBe(2); // printed 2/4
    expect(vl.TotalHP()).toBe(4);
  });

  it("does NOT buff friendly GROUND units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .Build(),
    );

    const marine = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(marine.CurrentPower()).toBe(3);
    expect(marine.TotalHP()).toBe(3);
  });

  it("does NOT buff ENEMY space units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    const enemyTie = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(enemyTie.CurrentPower()).toBe(2);
    expect(enemyTie.TotalHP()).toBe(1);
  });

  it("two Victor Leaders each buff the other", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.spaceArena[0]).CurrentPower()).toBe(3);
    expect(Unit.FromInterface(g.state.player1.spaceArena[1]).CurrentPower()).toBe(3);
  });

  it("stops buffing once it loses its abilities", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.victorLeader)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "@", owner: 2, controller: 2 },
        ])
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.spaceArena[1]).CurrentPower()).toBe(2);
  });
});
