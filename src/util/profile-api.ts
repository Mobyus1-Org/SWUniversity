import type {
  DifficultyBreakdown,
  DifficultyKey,
  EndlessModeStats,
  GameCompletedEntry,
  TrackedApp,
  TrackedGameMode,
  DatabankCompletion,
} from "@/util/profile-data";

export type BadgeViewModel = {
  id: string;
  displayName: string;
  description: string;
  img: string;
};

export type UserProfile = {
  _id?: string;
  userId: string;
  gamesCompleted: GameCompletedEntry[];
  endlessModeStats: EndlessModeStats;
  badges: string[];
  badgeDetails: BadgeViewModel[];
  solvedPuzzleIds: string[];
  masteredQuizIds: string[];
  masteredDykswuIds: string[];
  databankCompletion?: {
    quiz: DatabankCompletion;
    dykswu: DatabankCompletion;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ProfileUpdateResponse = {
  success: boolean;
  profile?: UserProfile | null;
  error?: string;
};

export async function logGameCompletion(
  app: TrackedApp,
  mode: TrackedGameMode,
  correct: number,
  total: number,
  difficultyBreakdown: DifficultyBreakdown,
): Promise<ProfileUpdateResponse> {
  try {
    const response = await fetch("/api/profile/game-completed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ app, mode, correct, total, difficultyBreakdown }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to log game" };
    }

    return { success: true, profile: data.profile };
  } catch (error) {
    console.error("Error logging game completion:", error);
    return { success: false, error: "Network error" };
  }
}

export async function updateEndlessModeStats(
  app: TrackedApp,
  correct: boolean,
  difficulty: DifficultyKey,
): Promise<ProfileUpdateResponse> {
  try {
    const response = await fetch("/api/profile/endless-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ app, correct, difficulty }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to update stats" };
    }

    return { success: true, profile: data.profile };
  } catch (error) {
    console.error("Error updating endless mode stats:", error);
    return { success: false, error: "Network error" };
  }
}

export async function masterQuestion(
  app: TrackedApp,
  key: string,
): Promise<ProfileUpdateResponse> {
  try {
    const response = await fetch("/api/profile/master-question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ app, key }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to record mastered question" };
    }

    return { success: true, profile: data.profile };
  } catch (error) {
    console.error("Error recording mastered question:", error);
    return { success: false, error: "Network error" };
  }
}

export async function masterQuestions(
  app: TrackedApp,
  keys: string[],
): Promise<ProfileUpdateResponse> {
  if (keys.length === 0) {
    return { success: true };
  }
  try {
    const response = await fetch("/api/profile/master-question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ app, keys }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to record mastered questions" };
    }

    return { success: true, profile: data.profile };
  } catch (error) {
    console.error("Error recording mastered questions:", error);
    return { success: false, error: "Network error" };
  }
}

export async function getMasteredIds(): Promise<{
  loggedIn: boolean;
  masteredQuizIds: string[];
  masteredDykswuIds: string[];
}> {
  try {
    const response = await fetch("/api/profile/mastered", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return { loggedIn: false, masteredQuizIds: [], masteredDykswuIds: [] };
    }

    const data = await response.json();
    return {
      loggedIn: true,
      masteredQuizIds: Array.isArray(data.masteredQuizIds) ? data.masteredQuizIds : [],
      masteredDykswuIds: Array.isArray(data.masteredDykswuIds) ? data.masteredDykswuIds : [],
    };
  } catch (error) {
    console.error("Error loading mastered questions:", error);
    return { loggedIn: false, masteredQuizIds: [], masteredDykswuIds: [] };
  }
}

export async function awardBadge(badgeId: string): Promise<ProfileUpdateResponse> {
  try {
    const response = await fetch("/api/profile/award-badge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ badgeId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to award badge" };
    }

    return { success: true, profile: data.profile };
  } catch (error) {
    console.error("Error awarding badge:", error);
    return { success: false, error: "Network error" };
  }
}
