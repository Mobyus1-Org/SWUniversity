export type DifficultyKey = "padawan" | "knight" | "master";
export type TrackedGameMode = "standard" | "iron-man" | "padawan" | "knight" | "master";
export type TrackedApp = "quiz" | "dykswu";

export type DifficultyStats = {
  correct: number;
  total: number;
};

export type DifficultyBreakdown = Record<DifficultyKey, DifficultyStats>;

export type GameCompletedEntry = {
  date: string | Date;
  app: TrackedApp;
  mode: TrackedGameMode;
  correct: number;
  total: number;
  difficultyBreakdown: DifficultyBreakdown;
};

export type EndlessAppStats = {
  correct: number;
  total: number;
  difficultyBreakdown: DifficultyBreakdown;
};

export type EndlessModeStats = {
  quiz: EndlessAppStats;
  dykswu: EndlessAppStats;
};

export type ProfileStatsSource = {
  gamesCompleted: GameCompletedEntry[];
  endlessModeStats: EndlessModeStats;
};

export type DerivedAppStats = {
  correct: number;
  total: number;
  difficultyBreakdown: DifficultyBreakdown;
  standardRunsCompleted: number;
  longestIronManRun: number;
  ironManRunsAttempted: number;
  ironManRunsCompleted: number;
};

export type DerivedProfileStats = {
  totalAnswered: number;
  totalCorrect: number;
  quiz: DerivedAppStats;
  dykswu: DerivedAppStats;
};

export type DatabankDifficultyStats = {
  mastered: number;
  total: number;
};

export type DatabankCompletion = Record<DifficultyKey, DatabankDifficultyStats>;

export function createEmptyDatabankCompletion(): DatabankCompletion {
  return {
    padawan: { mastered: 0, total: 0 },
    knight: { mastered: 0, total: 0 },
    master: { mastered: 0, total: 0 },
  };
}

export function createEmptyDifficultyBreakdown(): DifficultyBreakdown {
  return {
    padawan: { correct: 0, total: 0 },
    knight: { correct: 0, total: 0 },
    master: { correct: 0, total: 0 },
  };
}

export function createEmptyEndlessAppStats(): EndlessAppStats {
  return {
    correct: 0,
    total: 0,
    difficultyBreakdown: createEmptyDifficultyBreakdown(),
  };
}

export function createEmptyEndlessModeStats(): EndlessModeStats {
  return {
    quiz: createEmptyEndlessAppStats(),
    dykswu: createEmptyEndlessAppStats(),
  };
}

export function difficultyIndexToKey(index: number): DifficultyKey {
  switch (index) {
    case 0:
      return "padawan";
    case 1:
      return "knight";
    case 2:
      return "master";
    default:
      throw new Error(`Unexpected difficulty index: ${index}`);
  }
}

export function cloneDifficultyBreakdown(breakdown: DifficultyBreakdown): DifficultyBreakdown {
  return {
    padawan: { ...breakdown.padawan },
    knight: { ...breakdown.knight },
    master: { ...breakdown.master },
  };
}

export function addToDifficultyBreakdown(
  breakdown: DifficultyBreakdown,
  difficulty: DifficultyKey,
  correct: number,
  total: number,
): DifficultyBreakdown {
  return {
    ...breakdown,
    [difficulty]: {
      correct: breakdown[difficulty].correct + correct,
      total: breakdown[difficulty].total + total,
    },
  };
}

function mergeDifficultyBreakdown(
  base: DifficultyBreakdown,
  addition: DifficultyBreakdown,
): DifficultyBreakdown {
  return {
    padawan: {
      correct: base.padawan.correct + addition.padawan.correct,
      total: base.padawan.total + addition.padawan.total,
    },
    knight: {
      correct: base.knight.correct + addition.knight.correct,
      total: base.knight.total + addition.knight.total,
    },
    master: {
      correct: base.master.correct + addition.master.correct,
      total: base.master.total + addition.master.total,
    },
  };
}

function createEmptyDerivedAppStats(): DerivedAppStats {
  return {
    correct: 0,
    total: 0,
    difficultyBreakdown: createEmptyDifficultyBreakdown(),
    standardRunsCompleted: 0,
    longestIronManRun: 0,
    ironManRunsAttempted: 0,
    ironManRunsCompleted: 0,
  };
}

export function deriveProfileStats(profile: ProfileStatsSource | null): DerivedProfileStats {
  const quiz = createEmptyDerivedAppStats();
  const dykswu = createEmptyDerivedAppStats();

  if (!profile) {
    return {
      totalAnswered: 0,
      totalCorrect: 0,
      quiz,
      dykswu,
    };
  }

  for (const game of profile.gamesCompleted) {
    const target = game.app === "quiz" ? quiz : dykswu;

    // Stats only track questions answered in standard mode.
    if (game.mode === "standard") {
      target.correct += game.correct;
      target.total += game.total;
      target.difficultyBreakdown = mergeDifficultyBreakdown(target.difficultyBreakdown, game.difficultyBreakdown);
      target.standardRunsCompleted += 1;
    }

    // Iron Man ends on the first miss, so the correct count is the run length.
    if (game.mode === "iron-man") {
      target.longestIronManRun = Math.max(target.longestIronManRun, game.correct);
      target.ironManRunsAttempted += 1;
      if (game.total > 0 && game.correct === game.total) {
        target.ironManRunsCompleted += 1;
      }
    }
  }

  return {
    totalAnswered: quiz.total + dykswu.total,
    totalCorrect: quiz.correct + dykswu.correct,
    quiz,
    dykswu,
  };
}
