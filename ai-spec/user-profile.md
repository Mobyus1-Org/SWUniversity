# Overview
To add more pieces to a user not related to auth

# Requirements
REQ-1: Collection of games completed. These will be used later to display stats for a user
REQ-2: When a non-endless mode game is completed, its stats get logged to the gamesCompleted collection
REQ-3: Object with counters for Endless Mode questions answered.
REQ-4: When a question is answered in Endless Mode for either SWUniversity App, the appropriate count is updated in the DB.
REQ-5: Badges, a collection of achievements acquired based on criteria.
REQ-6: When a user completes the Iron Man challenge for the Quiz app, then they will get the iron_man_quiz_2026 badge added to their collection in the DB.
REQ-7: When a user completes the Iron Man challenge for the Do You Know SWU app, then they will get the iron_man_dykswu_2026 badge added to their collection in the DB.
REQ-8: Hold constants so that these badges can be manually updated every year for each SWUniveristy App.
REQ-9: User profile data lives in a separate UserProfile collection, one profile per user, created at signup with defaults or empty values.
REQ-10: Profile tracking only applies to authenticated users. Guest play is not persisted.
REQ-11: gamesCompleted logs every non-endless run for quiz and dykswu: standard, iron-man, padawan, knight, and master.
REQ-12: Badges are unique. Re-earning the same badge must not create duplicates.
REQ-13: Badge constants should be simple exported values for the current year, with 2026 starting values for quiz and dykswu.
REQ-14: endlessModeQuestionsAnswered is updated after every answered endless question, not batched. This is due to the UI not having a good way to "end" a game of endless. so if we batch, we might lose a mid-batch run.
REQ-15: Iron Man attempts are logged whether the user succeeds or fails.
REQ-16: For DYKSWU, stored score values should support fractional correctness because the UI awards 0.5 increments. That means correct should be typed as number, not assumed integer.

# Data
## DATA-1: UserProfiles
```typescript
interface UserProfile {
  _id: MongoDBUserId;
  userId: MongoDBUserId;
  gamesCompleted: [
    {
      date: DateTime;
      app: SWUniversityApp;
      mode: AppModes;
      correct: number;
      total: number;
    }
  ];
  endlessModeQuestionsAnswered: {
    quizCorrect: number;
    quizTotal: number;
    dykswuCorrect: number;
    dykswuTotal: number;
  };
  badges: [
    BadgeType
  ];
}
```
## DATA-2: BadgeType
BadgeType will grow. but for now, start with these:
- iron_man_quiz_2026
- iron_man_dykswu_2026

the descriptions for these badges will live as constants. for now give them filler text.