import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// JTL_052 D'Qar Cargo Frigate (Unit 6/7 Space, cost 5, Vigilance/Heroism)
//   "This unit gets –1/–0 for each damage on it."

const DQAR = Cards.units.jtl.dqarCargoFrigate;

function statsWithDamage(damage: number, cardId = DQAR) {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, cardId, true, damage)
      .Build(),
  );
  const u = Unit.FromInterface(g.state.player1.spaceArena[0]);
  return { power: u.CurrentPower(), hp: u.TotalHP() };
}

describe("JTL_052 D'Qar Cargo Frigate", () => {
  it("undamaged it is 6/7", () => {
    expect(statsWithDamage(0)).toEqual({ power: 6, hp: 7 });
  });

  it("loses 1 power per damage — HP is untouched", () => {
    expect(statsWithDamage(3)).toEqual({ power: 3, hp: 7 });
  });

  it("power never drops below 0", () => {
    expect(statsWithDamage(6).power).toBe(0);
  });

  it("control: another damaged unit keeps its power", () => {
    expect(statsWithDamage(3, Cards.units.lof.hyperspaceWayfarer).power).toBe(4);
  });
});
