import { BADGES, isBadgeId, type BadgeDefinition, type BadgeId } from "@/server/badges";
import type { UserProfileDocument } from "@/server/models/UserProfile";
import type { EndlessModeStats, GameCompletedEntry } from "@/util/profile-data";
import {
  createEmptyDifficultyBreakdown,
  createEmptyEndlessModeStats,
} from "@/util/profile-data";

type ObjectIdLike = {
  toString(): string;
};

type UserProfileLike = {
  _id?: string | ObjectIdLike;
  userId: string | ObjectIdLike;
  gamesCompleted?: UserProfileDocument["gamesCompleted"];
  endlessModeStats?: EndlessModeStats;
  badges?: string[];
  solvedPuzzleIds?: string[];
  masteredQuizIds?: string[];
  masteredDykswuIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};
export type BadgeViewModel = BadgeDefinition;

export type UserProfileResponse = {
  _id?: string;
  userId: string;
  gamesCompleted: GameCompletedEntry[];
  endlessModeStats: EndlessModeStats;
  badges: BadgeId[];
  badgeDetails: BadgeViewModel[];
  solvedPuzzleIds: string[];
  masteredQuizIds: string[];
  masteredDykswuIds: string[];
  createdAt?: string;
  updatedAt?: string;
};
function toStringId(value?: string | ObjectIdLike): string | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value === "string" ? value : value.toString();
}

function toBadgeDetails(badges: string[]): BadgeViewModel[] {
  return badges.filter(isBadgeId).map((badgeId) => BADGES[badgeId]);
}

function normalizeGamesCompleted(gamesCompleted: UserProfileLike["gamesCompleted"]): GameCompletedEntry[] {
  return (gamesCompleted || []).map((game) => ({
    date: game.date,
    app: game.app,
    mode: game.mode,
    correct: game.correct,
    total: game.total,
    difficultyBreakdown: game.difficultyBreakdown || createEmptyDifficultyBreakdown(),
  }));
}

function normalizeEndlessModeStats(profile: UserProfileLike): EndlessModeStats {
  if (!profile.endlessModeStats) {
    return createEmptyEndlessModeStats();
  }

  return {
    quiz: {
      correct: profile.endlessModeStats.quiz?.correct || 0,
      total: profile.endlessModeStats.quiz?.total || 0,
      difficultyBreakdown:
        profile.endlessModeStats.quiz?.difficultyBreakdown || createEmptyDifficultyBreakdown(),
    },
    dykswu: {
      correct: profile.endlessModeStats.dykswu?.correct || 0,
      total: profile.endlessModeStats.dykswu?.total || 0,
      difficultyBreakdown:
        profile.endlessModeStats.dykswu?.difficultyBreakdown || createEmptyDifficultyBreakdown(),
    },
  };
}

export function serializeUserProfile(profile: UserProfileLike | null): UserProfileResponse | null {
  if (!profile) {
    return null;
  }

  const badgeIds = (profile.badges || []).filter(isBadgeId);

  return {
    _id: toStringId(profile._id),
    userId: toStringId(profile.userId) || "",
    gamesCompleted: normalizeGamesCompleted(profile.gamesCompleted),
    endlessModeStats: normalizeEndlessModeStats(profile),
    badges: badgeIds,
    badgeDetails: toBadgeDetails(profile.badges || []),
    solvedPuzzleIds: profile.solvedPuzzleIds || [],
    masteredQuizIds: profile.masteredQuizIds || [],
    masteredDykswuIds: profile.masteredDykswuIds || [],
    createdAt: profile.createdAt?.toISOString(),
    updatedAt: profile.updatedAt?.toISOString(),
  };
}