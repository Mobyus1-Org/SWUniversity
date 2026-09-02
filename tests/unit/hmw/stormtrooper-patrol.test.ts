import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// HMW_107 Stormtrooper Patrol (2/4 Ground, cost 3, Command/Villainy, Imperial/Trooper) —
//   "Sentinel"
//   "While you control another unit that costs 3 or more, this unit gets +2/+0."
//
// A while-condition, so it is worth the bonus ONCE however many qualifying units are out, and it
// is power-only — the HP never moves. "Another" excludes the Patrol itself, which matters because
// the Patrol costs 3 and would otherwise satisfy its own condition.

const PATROL = "HMW_107";
const COST_3 = "IBH_008";                          // Crix Madine — cost 3, the threshold exactly
const COST_4 = Cards.units.sor.consularSecurityForce; // cost 4
const COST_2 = Cards.units.sor.battlefieldMarine;  // cost 2 — under the bar

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const patrol = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === PATROL)!);

describe("HMW_107 Stormtrooper Patrol", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, PATROL).Build());
    const u = g.state.player1.groundArena[0];

    expect(HasSentinel(u.cardId, u.playId, 1)).toBe(true);
  });

  it("gets +2/+0 while you control another unit costing 3 or more", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithGroundUnitForPlayer(1, COST_4)
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(4); // 2 + 2
    expect(patrol(g).TotalHP()).toBe(4);      // unchanged — the bonus is power-only
  });

  it("cost 3 exactly meets the bar", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithGroundUnitForPlayer(1, COST_3)
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(4);
  });

  it("control: another unit costing 2 is not enough", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithGroundUnitForPlayer(1, COST_2)
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(2);
  });

  it("does not count ITSELF — the Patrol costs 3, and the text says 'another'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, PATROL).Build());

    expect(patrol(g).CurrentPower()).toBe(2);
  });

  it("a second Patrol DOES count as 'another'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithGroundUnitForPlayer(1, PATROL)
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(4);
  });

  it("an ENEMY unit costing 3+ does not count — 'you control'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithGroundUnitForPlayer(2, COST_4)
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(2);
  });

  it("counts a qualifying unit in the OTHER arena — no arena restriction", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithSpaceUnitForPlayer(1, Cards.units.twi.tranquility) // cost 7 Space
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(4);
  });

  it("is worth the bonus ONCE, however many qualifying units are out", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, PATROL)
        .WithGroundUnitForPlayer(1, COST_4)
        .WithGroundUnitForPlayer(1, COST_4)
        .WithGroundUnitForPlayer(1, COST_3)
        .Build(),
    );

    expect(patrol(g).CurrentPower()).toBe(4); // 2 + 2, not 2 + 6
  });
});
