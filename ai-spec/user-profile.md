# Overview
To add user profile data that is separate from auth and can power profile stats UI.

# Requirements
REQ-1: Add a separate `UserProfile` collection with one profile per user.
REQ-2: A `UserProfile` is created during signup with default empty values.
REQ-3: Profile tracking only applies to authenticated users. Guest play is not persisted.
REQ-4: `gamesCompleted` stores one entry for each completed non-endless run.
REQ-5: `gamesCompleted` includes runs for `standard`, `iron-man`, `padawan`, `knight`, and `master`.
REQ-6: Iron Man attempts are logged whether the user succeeds or fails.
REQ-7: Iron Man success is inferred from the run entry when `correct === total`.
REQ-8: Each `gamesCompleted` entry includes a `difficultyBreakdown` for `padawan`, `knight`, and `master` based on the actual underlying difficulty of the questions/cards answered during that run.
REQ-9: The `difficultyBreakdown` is stored even for runs whose selected mode is already a single difficulty. Redundancy is acceptable.
REQ-10: DYKSWU score values support fractional correctness because the UI awards 0.5 increments.
REQ-11: `endlessModeStats` is updated after every answered endless question and is not batched.
REQ-12: `endlessModeStats` includes both overall app totals and per-difficulty breakdowns for `padawan`, `knight`, and `master`.
REQ-13: Endless writes include the underlying difficulty of the answered question/card so difficulty buckets remain accurate.
REQ-14: Badges are unique. Re-earning the same badge must not create duplicates.
REQ-15: When a user completes the Iron Man challenge for Quiz, add `iron_man_quiz_2026` to their badges.
REQ-16: When a user completes the Iron Man challenge for Do You Know SWU, add `iron_man_dykswu_2026` to their badges.
REQ-17: Badge constants should be simple exported values for the current year, with 2026 starting values for Quiz and Do You Know SWU.
REQ-18: The UI badge model includes `displayName` and `img` so badges can be rendered on the profile page.
REQ-19: The Profile page includes a second panel for user stats.
REQ-20: The stats panel shows total questions answered, including endless.
REQ-21: The stats panel shows total questions correct, including endless.
REQ-22: Total correct continues to use fractional DYKSWU scoring.
REQ-23: The stats panel has two collapsible sections: one for Quiz and one for Do You Know SWU.
REQ-24: Each app section shows `correct / total` for Padawan difficulty.
REQ-25: Each app section shows `correct / total` for Knight difficulty.
REQ-26: Each app section shows `correct / total` for Master difficulty.
REQ-27: Quiz stats show the number of Standard runs completed.
REQ-28: Do You Know SWU stats show the number of Standard runs completed.
REQ-29: Each app section shows the number of successful Iron Man completions.
REQ-30: REQ-19 through REQ-29 are derived from existing profile data in the UI and do not require a separately persisted aggregate stats object.

# Data
## DATA-1: DifficultyBreakdown
```typescript
interface DifficultyBreakdown {
  padawan: {
    correct: number;
    total: number;
  };
  knight: {
    correct: number;
    total: number;
  };
  master: {
    correct: number;
    total: number;
  };
}
```

## DATA-2: GameCompletedEntry
```typescript
interface GameCompletedEntry {
  date: DateTime;
  app: SWUniversityApp;
  mode: "standard" | "iron-man" | "padawan" | "knight" | "master";
  correct: number;
  total: number;
  difficultyBreakdown: DifficultyBreakdown;
}
```

## DATA-3: EndlessAppStats
```typescript
interface EndlessAppStats {
  correct: number;
  total: number;
  difficultyBreakdown: DifficultyBreakdown;
}
```

## DATA-4: UserProfile
```typescript
interface UserProfile {
  _id: MongoDBUserId;
  userId: MongoDBUserId;
  gamesCompleted: GameCompletedEntry[];
  endlessModeStats: {
    quiz: EndlessAppStats;
    dykswu: EndlessAppStats;
  };
  badges: BadgeType[];
}
```

## DATA-5: BadgeType
BadgeType will grow, but for now start with these:
- `iron_man_quiz_2026`
- `iron_man_dykswu_2026`

Badge descriptions, display names, and image paths live as constants. Filler descriptions are acceptable for now.