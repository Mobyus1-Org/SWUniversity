import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Puzzle mode is a single action phase. Passing to regroup without winning means the opponent
// would take the next turn, so reaching the "Choose a resource" step fails the puzzle.
//
// The two failure modes must not race, and the engine ordering is what guarantees it: the
// empty-deck penalty (2 regroup draws x 3 damage = 6) is applied INSIDE executeRegroupDraw,
// which only afterwards sets gamePhase = "RegroupResource". So a lethal regroup draw is already
// a base defeat, and the regroup-failure state is reachable only by a player who survived.
//
// deriveStatus lives in PuzzlesPage (a .tsx container) and is not exported, so these tests pin
// the ENGINE-side facts the UI status derives from: the phase reached and whether P1 died.

const MARINE = Cards.units.sor.battlefieldMarine;

/** Both players pass consecutively — P1 has acted, so P2 passes first. */
async function passToRegroup(g: GameTestAdapter) {
  await g.dispatchAsync(1, "pass-action", {});
  await g.dispatchAsync(2, "pass-action", {});
}

function setup(opts: { baseDamage?: number; deckCards?: number }) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, opts.baseDamage ?? 0)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 6);
  for (let i = 0; i < (opts.deckCards ?? 0); i++) b = b.WithCardInDeckForPlayer(1, MARINE);
  return b;
}

describe("puzzle regroup failure", () => {
  it("reaches the Choose-a-resource step alive when the deck covers both draws", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ baseDamage: 0, deckCards: 2 }).Build());

    await passToRegroup(g);

    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.defeatedPlayers).toEqual([]); // survived — the new failure path
    expect(g.state.player1.base.damage).toBe(0); // deck covered both draws, no penalty
  });

  it("an empty deck costs 6 (2 missed draws x 3) and still reaches the step when survivable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ baseDamage: 0, deckCards: 0 }).Build());

    await passToRegroup(g);

    expect(g.state.player1.base.damage).toBe(6);
    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.defeatedPlayers).toEqual([]);
  });

  it("a LETHAL empty-deck draw is a base defeat, not the regroup-failure state", async () => {
    const g = new GameTestAdapter();
    // 30 HP base at 24 damage: the 6 from two missed draws is exactly lethal.
    g.loadNewState(setup({ baseDamage: 24, deckCards: 0 }).Build());

    await passToRegroup(g);

    expect(g.state.player1.base.damage).toBe(30);
    expect(g.state.defeatedPlayers).toContain(1);
    // The defeat is recorded, so the UI derives "lost" before it ever considers the phase —
    // this is the ordering guarantee that keeps the two failure modes from racing.
  });

  it("one card in deck: the second draw still costs 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ baseDamage: 0, deckCards: 1 }).Build());

    await passToRegroup(g);

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.defeatedPlayers).toEqual([]);
  });

  it("does not reach the step while the action phase is still live", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ deckCards: 2 }).Build());

    await g.dispatchAsync(1, "pass-action", {}); // a single pass is not enough

    expect(g.state.gamePhase).toBe("ActionPhase");
  });
});
