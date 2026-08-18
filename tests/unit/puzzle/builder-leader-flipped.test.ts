import { describe, it, expect } from "vitest";
import { toRaw, fromRaw, type BuilderState, type PlayerBuilderState } from "@/components/Shared/puzzle-builder-state";
import { hydratePuzzleGame, type RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import { Cards } from "../../card-helpers";

// A double-sided leader (TWI_017 Chancellor Palpatine // Darth Sidious) can start a puzzle on
// EITHER face — a Sidious-side puzzle is a different board than a Chancellor-side one, right down
// to which aspect the leader covers. The builder had no way to author that, and the runtime
// hydrator dropped `flipped` even when the stored state carried it.

const PALPATINE = Cards.leaders.twi.chancellorPalpatine;

function player(overrides: Partial<PlayerBuilderState> = {}): PlayerBuilderState {
  return {
    baseCardId: "SOR_029", baseDamage: 0, baseEpicActionUsed: false,
    leaderCardId: "SOR_017", leaderReady: true, leaderDeployed: false,
    leaderEpicActionUsed: false, leaderFlipped: false,
    resources: [], handCards: [], deck: [], discard: [], groundUnits: [], spaceUnits: [],
    creditTokens: 0, forceToken: false,
    ...overrides,
  } as PlayerBuilderState;
}

function builderState(p1: PlayerBuilderState, p2: PlayerBuilderState): BuilderState {
  return {
    name: "t", description: "", infoText: "", difficulty: 1, author: "",
    intendedSolution: [], hints: [], assetPath: "",
    activePlayer: 1, gamePhase: "ActionPhase", currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: false,
    player1: p1, player2: p2,
  } as BuilderState;
}

type RawSide = { leader: { cardId: string; flipped?: boolean } };

describe("puzzle builder — double-sided leader starting face", () => {
  it("writes leader.flipped when the leader starts on its back face", () => {
    const raw = toRaw(builderState(
      player({ leaderCardId: PALPATINE, leaderFlipped: true }),
      player(),
    )) as unknown as { player1: RawSide };

    expect(raw.player1.leader.flipped).toBe(true);
  });

  it("leaves leader.flipped off for a leader starting on its front face", () => {
    const raw = toRaw(builderState(
      player({ leaderCardId: PALPATINE }),
      player(),
    )) as unknown as { player1: RawSide };

    expect(raw.player1.leader.flipped ?? false).toBe(false);
  });

  it("round-trips through toRaw/fromRaw", () => {
    const original = builderState(
      player({ leaderCardId: PALPATINE, leaderFlipped: true }),
      player({ leaderCardId: PALPATINE, leaderFlipped: false }),
    );

    const reloaded = fromRaw(
      toRaw(original) as unknown as Record<string, unknown>,
      { name: "t", description: "", difficulty: 1 },
    );

    expect(reloaded.player1.leaderFlipped).toBe(true);
    expect(reloaded.player2.leaderFlipped).toBe(false);
  });

  it("survives hydration into a live game state", () => {
    const raw = toRaw(builderState(
      player({ leaderCardId: PALPATINE, leaderFlipped: true }),
      player(),
    )) as unknown as RawPuzzleGameState;

    const game = hydratePuzzleGame(raw);

    expect(game.player1.leader.flipped).toBe(true);
    expect(game.player2.leader.flipped ?? false).toBe(false);
  });
});
