import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_256 Jedi Interceptor (2/2 Space, cost 2, Heroism) —
//   "While you control 6 or more resources, this unit gets +2/+0."
// Same text as SOR_081 / SHD_083 Seasoned Shoretrooper. Exhausted resources count (control).

const INTERCEPTOR = Cards.units.hmw.jediInterceptor;
const FILLER = Cards.units.sor.battlefieldMarine;

function board(resources: number, ready = true) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, FILLER, resources, ready)
    .FillResourcesForPlayer(2, FILLER, 8)
    .WithSpaceUnitForPlayer(1, INTERCEPTOR)
    .WithActivePlayer(1);
}

const power = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player1.spaceArena.find(u => u.cardId === INTERCEPTOR)!).CurrentPower();
const hp = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player1.spaceArena.find(u => u.cardId === INTERCEPTOR)!).CurrentHP();

describe("HMW_256 Jedi Interceptor", () => {
  it("gets +2/+0 at 6 resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());
    expect(power(g)).toBe(4);
    expect(hp(g)).toBe(2);
  });

  it("is a plain 2/2 at 5 resources (the opponent's 8 do not count)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).Build());
    expect(power(g)).toBe(2);
  });

  it("counts exhausted resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6, false).Build());
    expect(power(g)).toBe(4);
  });
});
