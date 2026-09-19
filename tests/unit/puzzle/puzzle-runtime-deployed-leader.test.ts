import { describe, it, expect } from "vitest";
import { hydratePuzzleGame, type RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// A puzzle can start with a leader already deployed. The builder stores `deployed: true` and the
// leader's unit in an arena, but never the link between them (`leader.deployedPlayId`) — so
// anything that finds a deployed leader through that link came up empty. HMW_004 The Death Star's
// "When the regroup phase starts" ability is one: the puzzle skipped straight to the failed-regroup
// popup instead of offering it. Hydration now links a deployed leader to its unit (or, for a leader
// deployed as a Pilot, to the upgrade carrying it).

const TARKIN = Cards.leaders.hmw.grandMoffTarkin;
const MARINE = Cards.units.sor.battlefieldMarine;

const unit = (cardId: string, player: 1 | 2, upgrades: unknown[] = []) => ({
  cardId, playId: "@", owner: player, controller: player, ready: true, damage: 0, upgrades, captives: [],
});

function rawPuzzle(p1: Record<string, unknown>): RawPuzzleGameState {
  const side = (leader: string, extra: Record<string, unknown> = {}) => ({
    base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
    leader: { cardId: leader, ready: true, deployed: false, epicActionUsed: false },
    groundArena: [], spaceArena: [], resources: [], discard: [], hand: [],
    deck: [{ cardId: MARINE }, { cardId: MARINE }],
    supplemental: {},
    ...extra,
  });
  return {
    activePlayer: 1,
    gamePhase: 0, // ActionPhase
    currentRound: 1,
    initiativePlayer: 1,
    initiativeClaimed: false,
    player1: side(TARKIN, p1),
    player2: side(Cards.leaders.sor.sabineWren),
  } as unknown as RawPuzzleGameState;
}

describe("puzzle hydration — a leader that starts deployed", () => {
  it("is linked to its unit in the arena", () => {
    const game = hydratePuzzleGame(rawPuzzle({
      leader: { cardId: TARKIN, ready: true, deployed: true, epicActionUsed: true },
      spaceArena: [unit(TARKIN, 1)],
    }));

    expect(game.player1.leader.deployedPlayId).toBe(game.player1.spaceArena[0].playId);
  });

  it("deployed as a Pilot, is linked to the upgrade carrying it", () => {
    const pilotLeader = Cards.leaders.jtl.lukeSkywalker;
    const game = hydratePuzzleGame(rawPuzzle({
      leader: { cardId: pilotLeader, ready: true, deployed: true, epicActionUsed: true },
      spaceArena: [unit(Cards.units.jtl.phoenixSquadronAWing, 1, [
        { cardId: pilotLeader, playId: "@", owner: 1, controller: 1 },
      ])],
    }));

    expect(game.player1.leader.deployedPlayId).toBe(game.player1.spaceArena[0].upgrades[0].playId);
  });

  it("an undeployed leader stays unlinked", () => {
    const game = hydratePuzzleGame(rawPuzzle({}));

    expect(game.player1.leader.deployedPlayId).toBeUndefined();
  });

  it("so a puzzle starting with The Death Star offers its regroup ability instead of failing", async () => {
    const game = hydratePuzzleGame(rawPuzzle({
      leader: { cardId: TARKIN, ready: true, deployed: true, epicActionUsed: true },
      spaceArena: [unit(TARKIN, 1)],
    }));
    game.player2.base.damage = 20; // 10 remaining
    const g = new GameTestAdapter();
    g.loadNewState(game);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.gamePhase).toBe("RegroupDraw");
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.state.defeatedPlayers).toEqual([2]);
  });
});
