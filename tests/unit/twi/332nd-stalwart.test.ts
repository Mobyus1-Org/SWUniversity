import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_240 332nd Stalwart (1/2 Ground, Republic/Clone/Trooper, cost 1) —
//   "Coordinate — This unit gets +1/+1. (Gain this ability while you control 3 or more units.)"
describe("TWI_240 332nd Stalwart", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const stalwart = (g: GameTestAdapter) =>
    Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === Cards.units.twi.stalwart332nd)!);

  it("gets +1/+1 while you control 3 or more units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(stalwart(g).CurrentPower()).toBe(2); // 1 + 1
    expect(stalwart(g).TotalHP()).toBe(3);      // 2 + 1
  });

  it("control: with only 2 units Coordinate is inactive and it stays 1/2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(stalwart(g).CurrentPower()).toBe(1);
    expect(stalwart(g).TotalHP()).toBe(2);
  });

  it("counts units in BOTH arenas toward Coordinate", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(stalwart(g).CurrentPower()).toBe(2);
    expect(stalwart(g).TotalHP()).toBe(3);
  });

  it("only your own units count — enemy units do not switch Coordinate on", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(stalwart(g).CurrentPower()).toBe(1);
    expect(stalwart(g).TotalHP()).toBe(2);
  });
});
