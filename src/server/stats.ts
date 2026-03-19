import { readFile } from "fs/promises";
import path from "path";

import type { DYKSWUCounts, QuizCounts } from "@/util/stats-types";

type QuizEntry = {
  difficulty: number;
  answer: string;
  tags: string[];
};

type DykVariant = {
  difficulty: number;
  answer: string;
  followUp?: {
    answer: string;
  };
};

type DykEntry = {
  actualCard: string;
  variants: DykVariant[];
};

async function readJsonFile<T>(fileName: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function getQuizCountsServer(): Promise<QuizCounts> {
  const data = await readJsonFile<QuizEntry[]>("quiz-database.json");
  const counts: QuizCounts["counts"] = {};
  let totalCount = 0;
  const tagCounts: Record<string, number> = {};

  data.forEach((quiz) => {
    const { difficulty, answer, tags } = quiz;
    counts[difficulty] = counts[difficulty] || {};
    counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

    tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    totalCount += 1;
  });

  const sortedTagCounts = Object.fromEntries(
    Object.entries(tagCounts).sort(([, a], [, b]) => b - a),
  );

  return {
    counts,
    totalCount,
    tagCounts: sortedTagCounts,
  };
}

export async function getDykCountsServer(): Promise<DYKSWUCounts> {
  const data = await readJsonFile<DykEntry[]>("dykswu-database.json");
  const counts: DYKSWUCounts["counts"] = {
    followUpCounts: {},
    set: {
      0: { SOR: 0, SHD: 0, TWI: 0, JTL: 0, LOF: 0, IBH: 0, SEC: 0 },
      1: { SOR: 0, SHD: 0, TWI: 0, JTL: 0, LOF: 0, IBH: 0, SEC: 0 },
      2: { SOR: 0, SHD: 0, TWI: 0, JTL: 0, LOF: 0, IBH: 0, SEC: 0 },
    },
  };

  let totalCount = 0;
  let totalFollowUpCount = 0;

  data.forEach((entry) => {
    entry.variants.forEach((variant) => {
      const { difficulty, answer, followUp } = variant;
      const set = entry.actualCard.split("/")[0] || "SEC";

      counts[difficulty] = counts[difficulty] || {};
      counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

      if (set in counts.set[difficulty]) {
        counts.set[difficulty][set as keyof (typeof counts.set)[0]] += 1;
      }

      totalCount += 1;

      if (followUp) {
        counts.followUpCounts[difficulty] = counts.followUpCounts[difficulty] || {};
        counts.followUpCounts[difficulty][followUp.answer] =
          (counts.followUpCounts[difficulty][followUp.answer] || 0) + 1;
        totalFollowUpCount += 1;
      }
    });
  });

  return {
    counts,
    totalCount,
    totalFollowUpCount,
  };
}
