import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SOR_082 Emperor's Royal Guard (3/4 Ground, cost 3, Command/Villainy, Imperial)
//   "While you control an OFFICIAL unit, this unit gains Sentinel."
//   "While you control Emperor Palpatine (as a leader or unit), this unit gets +0/+1."

const GUARD = Cards.units.sor.emperorsRoyalGuard;
const MARINE = Cards.units.sor.battlefieldMarine;
const CLIENT = Cards.units.shd.theClient; // Imperial, Official

function board(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.emperorPalpatine) // the OPPONENT's Palpatine never counts
    .WithGroundUnitForPlayer(1, GUARD)
    .WithActivePlayer(1);
}

function load(state: ReturnType<GameStateBuilder["Build"]>) {
  const g = new GameTestAdapter();
  g.loadNewState(state);
  return g;
}

const hp = (g: GameTestAdapter) => Unit.FromInterface(g.state.player1.groundArena[0]).TotalHP();

describe("SOR_082 Emperor's Royal Guard", () => {
  it("+0/+1 with Emperor Palpatine as your leader", () => {
    expect(hp(load(board(Cards.leaders.sor.emperorPalpatine).Build()))).toBe(5);
  });

  it("+0/+1 with Emperor Palpatine as a unit you control", () => {
    expect(hp(load(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(1, Cards.units.sor.emperorPalpatine).Build()))).toBe(5);
  });

  it("no bonus otherwise — the opponent's Palpatine doesn't count", () => {
    expect(hp(load(board(Cards.leaders.sor.sabineWren).Build()))).toBe(4);
  });

  it("has Sentinel only while you control an Official unit", () => {
    const without = load(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(1, MARINE).Build());
    expect(HasSentinel(GUARD, without.state.player1.groundArena[0].playId, 1)).toBeFalsy();
    const withOfficial = load(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(1, CLIENT).Build());
    expect(HasSentinel(GUARD, withOfficial.state.player1.groundArena[0].playId, 1)).toBe(true);
  });
});
