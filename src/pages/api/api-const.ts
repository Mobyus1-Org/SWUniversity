export type QuizCountEntry = {
  [difficulty: number]: {
    [answer: string]: number;
  };
}

export type QuizCounts = {
  counts: QuizCountEntry;
  totalCount: number;
};

export type DYKSWUCountEntry = {
  [difficulty: number]: {
    [answer: string]: number;
  };
  followUpCounts: {
    [difficulty: number]: {
      [answer: string]: number;
    };
  };
}

export type DYKSWUCounts = {
  counts: DYKSWUCountEntry;
  totalCount: number;
  totalFollowUpCount: number;
}