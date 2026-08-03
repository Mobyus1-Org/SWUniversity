import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_115 Clone Combat Squadron (3/3 Space, cost 4) —
//   "This unit gets +1/+1 for each other friendly space unit."
describe("JTL_115 Clone Combat Squadron", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const squad = (g: GameTestAdapter, i = 0) => Unit.FromInterface(g.state.player1.spaceArena[i]);

  it("alone: keeps its printed 3/3", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron).Build());

    expect(squad(g).CurrentPower()).toBe(3);
    expect(squad(g).TotalHP()).toBe(3);
  });

  it("gets +1/+1 for each OTHER friendly space unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(squad(g).CurrentPower()).toBe(5); // 3 + 2
    expect(squad(g).TotalHP()).toBe(5);
  });

  it("friendly GROUND units do not count", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(squad(g).CurrentPower()).toBe(3);
  });

  it("ENEMY space units do not count", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(squad(g).CurrentPower()).toBe(3);
  });

  it("two Squadrons each count the other", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron)
        .Build(),
    );

    expect(squad(g, 0).CurrentPower()).toBe(4);
    expect(squad(g, 1).CurrentPower()).toBe(4);
  });

  it("loses the bonus when it loses its abilities", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.cloneCombatSquadron)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "@", owner: 2, controller: 2 },
        ])
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(squad(g).CurrentPower()).toBe(3);
  });
});
