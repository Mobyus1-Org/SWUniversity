import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_090 Echo - Valiant ARC Trooper (2/2 Ground, cost 2) —
//   "Coordinate — This unit gets +2/+2. (Gain this ability while you control 3 or more units.)"
describe("TWI_090 Echo - Valiant ARC Trooper", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const echo = (g: GameTestAdapter) =>
    Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === Cards.units.twi.echoArcTrooper)!);

  it("gets +2/+2 while you control 3 or more units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.echoArcTrooper)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(echo(g).CurrentPower()).toBe(4); // 2 + 2
    expect(echo(g).TotalHP()).toBe(4);      // 2 + 2
  });

  it("control: with only 2 units Coordinate is inactive and he keeps 2/2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.echoArcTrooper)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(echo(g).CurrentPower()).toBe(2);
    expect(echo(g).TotalHP()).toBe(2);
  });

  it("counts units in BOTH arenas toward Coordinate", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.echoArcTrooper)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(echo(g).CurrentPower()).toBe(4);
  });

  it("the opponent's units do not count toward YOUR Coordinate", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.echoArcTrooper)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(echo(g).CurrentPower()).toBe(2);
  });

  it("loses the buff when he loses his abilities", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.echoArcTrooper)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "@", owner: 2, controller: 2 },
        ])
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(echo(g).CurrentPower()).toBe(2);
    expect(echo(g).TotalHP()).toBe(2);
  });
});
