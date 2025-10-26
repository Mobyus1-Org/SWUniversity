export type QuizCountEntry = {
  [difficulty: number]: {
    [answer: string]: number;
  };
}

export type QuizCounts = {
  counts: QuizCountEntry;
  totalCount: number;
  tagCounts: {
    [tag: string]: number;
  };
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
  set: {
    "SOR": number;
    "SHD": number;
    "TWI": number;
    "JTL": number;
    "LOF": number;
    "IBH": number;
    "SEC": number;
  };
}

export type DYKSWUCounts = {
  counts: DYKSWUCountEntry;
  totalCount: number;
  totalFollowUpCount: number;
}