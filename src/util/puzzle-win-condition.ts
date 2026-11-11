import type { GameState } from "@/lib/engine/game";

/**
 * What a puzzle asks the player to do. Shared by the client (status + modals) and the solver, so
 * the two can never disagree about what counts as a solution.
 */
export const PUZZLE_WIN_CONDITIONS = ["deal-lethal", "clear-board", "heal-full", "self-lethal"] as const;
export type PuzzleWinCondition = (typeof PUZZLE_WIN_CONDITIONS)[number];

/** Every puzzle saved before goals existed is a Find Lethal puzzle. */
export const DEFAULT_WIN_CONDITION: PuzzleWinCondition = "deal-lethal";

export const WIN_CONDITION_INFO: Record<PuzzleWinCondition, { title: string; goal: string }> = {
  "deal-lethal": { title: "Find Lethal", goal: "defeat your opponent's base" },
  "clear-board": { title: "Clear the Board", goal: "remove every unit from your opponent's side of the board" },
  "heal-full": { title: "Heal to Full", goal: "remove all damage from your base" },
  "self-lethal": { title: "On My Own Terms", goal: "defeat your own base" },
};

export function asWinCondition(value: unknown): PuzzleWinCondition {
  return (PUZZLE_WIN_CONDITIONS as readonly unknown[]).includes(value)
    ? (value as PuzzleWinCondition)
    : DEFAULT_WIN_CONDITION;
}

/**
 * The puzzle's goal is the only way to win. Ending the game any other way — the opponent's base
 * falling in a Clear the Board puzzle, say — is "lost", the same as losing your own base.
 */
export type PuzzleOutcome = "playing" | "won" | "lost" | "draw" | "failed-regroup";

/** The minimal board shape both a live GameState and a stored raw puzzle satisfy. */
type BoardShape = {
  player1: { base: { damage: number } };
  player2: { groundArena: unknown[]; spaceArena: unknown[] };
};

function boardGoalMet(gs: BoardShape, winCondition: PuzzleWinCondition): boolean {
  if (winCondition === "clear-board") return gs.player2.groundArena.length + gs.player2.spaceArena.length === 0;
  if (winCondition === "heal-full") return gs.player1.base.damage === 0;
  return false;
}

/**
 * @param promptOpen a resolution is still waiting on the player. Board goals are only judged once
 *   everything has resolved — the last enemy unit's When Defeated could still put a token back.
 */
export function puzzleOutcome(gs: GameState, winCondition: PuzzleWinCondition, promptOpen = false): PuzzleOutcome {
  const p1Defeated = gs.defeatedPlayers.includes(1);
  const p2Defeated = gs.defeatedPlayers.includes(2);
  const inActionPhase = gs.gamePhase === "ActionPhase";

  switch (winCondition) {
    case "deal-lethal":
      if (p1Defeated && p2Defeated) return "draw";
      if (p2Defeated) return "won";
      if (p1Defeated) return "lost";
      break;
    case "self-lethal":
      // Puzzles are a single action phase: a base lost to the regroup draw is not the solution.
      if (p1Defeated) return !p2Defeated && inActionPhase ? "won" : "lost";
      if (p2Defeated) return "lost";
      break;
    case "clear-board":
    case "heal-full":
      if (p1Defeated || p2Defeated) return "lost";
      if (!promptOpen && inActionPhase && boardGoalMet(gs, winCondition)) return "won";
      break;
  }

  // Reaching the "Choose a resource" step means the player passed without completing the goal.
  if (gs.gamePhase === "RegroupResource") return "failed-regroup";
  return "playing";
}

/** Fail-modal copy for a "lost" outcome: which way the game ended, and why that isn't the goal. */
export function lossExplanation(gs: GameState, winCondition: PuzzleWinCondition): string {
  const p1Defeated = gs.defeatedPlayers.includes(1);
  const p2Defeated = gs.defeatedPlayers.includes(2);
  const goal = WIN_CONDITION_INFO[winCondition].goal;
  const retry = "Reset to try again, or head back to the puzzles menu.";
  if (winCondition === "self-lethal") {
    if (p1Defeated && p2Defeated) return `Both bases were destroyed, but this puzzle's goal is to ${goal} only. ${retry}`;
    if (p1Defeated) return `Your base was defeated after the action phase ended. This puzzle has to be solved within a single action phase. ${retry}`;
  }
  if (!p1Defeated && p2Defeated) return `You destroyed your opponent's base, but this puzzle's goal is to ${goal}. ${retry}`;
  return `Your base was defeated. ${retry}`;
}

/** Why a puzzle's starting board can't be saved under this goal (already met or meaningless), or null. */
export function winConditionSetupError(gs: BoardShape, winCondition: PuzzleWinCondition): string | null {
  if (winCondition === "clear-board" && boardGoalMet(gs, winCondition)) {
    return "Clear the Board needs at least one unit on your opponent's side of the board.";
  }
  if (winCondition === "heal-full" && boardGoalMet(gs, winCondition)) {
    return "Heal to Full needs your base to start with damage on it.";
  }
  return null;
}
