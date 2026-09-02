import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// HMW_142 Wookie Rangers (5/6 Ground, cost 5, Command, Wookiee) —
//   "While you control another Wookiee unit or a Kashyyyk base, this unit gains Sentinel."
//
// An OR of two unrelated conditions, so BOTH halves need their own test — a card wired to only
// the unit half looks correct on any board that happens to have a second Wookiee.
//
// "Another" is load-bearing: the Rangers are themselves a Wookiee unit and would otherwise
// satisfy their own condition on an empty board.
//
// (The card's printed name is "Wookiee Rangers"; the mock carries a transcription typo, "Wookie".)

const RANGERS = "HMW_142";
const KASHYYYK_BASE = "HMW_021";                      // Kachirho
const OTHER_BASE = Cards.bases.common.green30HP;      // no Kashyyyk trait
const WOOKIEE = "HMW_118";                            // Ryyk Blademaster — Wookiee
const NON_WOOKIEE = Cards.units.sor.battlefieldMarine;

function board(base: string) {
  return new GameStateBuilder()
    .MyBase(base)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, RANGERS)
    .WithActivePlayer(1);
}

const hasSentinel = (g: GameTestAdapter) => {
  const u = g.state.player1.groundArena.find(x => x.cardId === RANGERS)!;
  return HasSentinel(u.cardId, u.playId, 1) === true;
};

describe("HMW_142 Wookie Rangers", () => {
  it("gains Sentinel from another WOOKIEE unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(OTHER_BASE).WithGroundUnitForPlayer(1, WOOKIEE).Build());

    expect(hasSentinel(g)).toBe(true);
  });

  it("gains Sentinel from a KASHYYYK base, with no other Wookiee", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(KASHYYYK_BASE).Build());

    expect(hasSentinel(g)).toBe(true);
  });

  it("has no Sentinel with neither", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(OTHER_BASE).WithGroundUnitForPlayer(1, NON_WOOKIEE).Build());

    expect(hasSentinel(g)).toBe(false);
  });

  it("does not count ITSELF — the Rangers are a Wookiee, and the text says 'another'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(OTHER_BASE).Build());

    expect(hasSentinel(g)).toBe(false);
  });

  it("a second copy DOES count as 'another'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(OTHER_BASE).WithGroundUnitForPlayer(1, RANGERS).Build());

    expect(hasSentinel(g)).toBe(true);
  });

  it("an ENEMY Wookiee does not count — 'you control'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(OTHER_BASE).WithGroundUnitForPlayer(2, WOOKIEE).Build());

    expect(hasSentinel(g)).toBe(false);
  });

  it("the OPPONENT's Kashyyyk base does not count", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(OTHER_BASE)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(KASHYYYK_BASE)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, RANGERS)
        .WithActivePlayer(1)
        .Build(),
    );

    expect(hasSentinel(g)).toBe(false);
  });

  it("both conditions at once is still just Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(KASHYYYK_BASE).WithGroundUnitForPlayer(1, WOOKIEE).Build());

    expect(hasSentinel(g)).toBe(true);
  });
});
