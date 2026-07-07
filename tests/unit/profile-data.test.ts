import { describe, it, expect } from "vitest";
import {
  deriveProfileStats,
  createEmptyEndlessModeStats,
  createEmptyDifficultyBreakdown,
  type ProfileStatsSource,
  type GameCompletedEntry,
} from "@/util/profile-data";

function source(games: GameCompletedEntry[]): ProfileStatsSource {
  return { gamesCompleted: games, endlessModeStats: createEmptyEndlessModeStats() };
}

function ironMan(app: "quiz" | "dykswu", correct: number, total: number): GameCompletedEntry {
  return { date: "2026-07-06", app, mode: "iron-man", correct, total, difficultyBreakdown: createEmptyDifficultyBreakdown() };
}

function standard(app: "quiz" | "dykswu", correct: number, total: number): GameCompletedEntry {
  return { date: "2026-07-06", app, mode: "standard", correct, total, difficultyBreakdown: createEmptyDifficultyBreakdown() };
}

describe("deriveProfileStats — ironman counts", () => {
  it("counts every ironman entry as attempted", () => {
    const stats = deriveProfileStats(source([ironMan("quiz", 3, 4), ironMan("quiz", 5, 5)]));
    expect(stats.quiz.ironManRunsAttempted).toBe(2);
  });

  it("counts only full clears (correct === total, total > 0) as completed", () => {
    const stats = deriveProfileStats(source([ironMan("quiz", 3, 4), ironMan("quiz", 5, 5), ironMan("quiz", 0, 0)]));
    expect(stats.quiz.ironManRunsCompleted).toBe(1);
  });

  it("still tracks longest ironman run", () => {
    const stats = deriveProfileStats(source([ironMan("quiz", 3, 4), ironMan("quiz", 7, 8)]));
    expect(stats.quiz.longestIronManRun).toBe(7);
  });

  it("does not count standard runs toward ironman counters", () => {
    const stats = deriveProfileStats(source([standard("quiz", 10, 10)]));
    expect(stats.quiz.ironManRunsAttempted).toBe(0);
    expect(stats.quiz.ironManRunsCompleted).toBe(0);
    expect(stats.quiz.standardRunsCompleted).toBe(1);
  });

  it("separates quiz and dykswu ironman counts", () => {
    const stats = deriveProfileStats(source([ironMan("quiz", 5, 5), ironMan("dykswu", 2, 3)]));
    expect(stats.quiz.ironManRunsCompleted).toBe(1);
    expect(stats.dykswu.ironManRunsAttempted).toBe(1);
    expect(stats.dykswu.ironManRunsCompleted).toBe(0);
  });
});
