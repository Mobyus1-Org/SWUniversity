import { describe, it, expect } from "vitest";
import {
  computeQuizDatabank,
  computeDykswuDatabank,
  type QuizPoolItem,
  type DykswuPoolItem,
} from "@/util/databank-completion";

const quizPool: QuizPoolItem[] = [
  { id: 1, difficulty: 0 },
  { id: 2, difficulty: 0 },
  { id: 3, difficulty: 1 },
  { id: 4, difficulty: 2 },
];

const dykswuPool: DykswuPoolItem[] = [
  { id: 10, variants: [{ difficulty: 0 }, { difficulty: 1 }] },
  { id: 11, variants: [{ difficulty: 2 }] },
];

describe("computeQuizDatabank", () => {
  it("uses per-difficulty question counts as denominators", () => {
    const result = computeQuizDatabank([], quizPool);
    expect(result.padawan.total).toBe(2);
    expect(result.knight.total).toBe(1);
    expect(result.master.total).toBe(1);
    expect(result.padawan.mastered).toBe(0);
  });

  it("buckets mastered ids by their question difficulty", () => {
    const result = computeQuizDatabank(["1", "3"], quizPool);
    expect(result.padawan.mastered).toBe(1);
    expect(result.knight.mastered).toBe(1);
    expect(result.master.mastered).toBe(0);
  });

  it("ignores ids not present in the pool and de-dupes", () => {
    const result = computeQuizDatabank(["1", "1", "999"], quizPool);
    expect(result.padawan.mastered).toBe(1);
  });
});

describe("computeDykswuDatabank", () => {
  it("counts each variant toward its own difficulty as the denominator", () => {
    const result = computeDykswuDatabank([], dykswuPool);
    expect(result.padawan.total).toBe(1);
    expect(result.knight.total).toBe(1);
    expect(result.master.total).toBe(1);
  });

  it("buckets a mastered variant key by that variant's difficulty", () => {
    const result = computeDykswuDatabank(["10:1", "11:0"], dykswuPool);
    expect(result.knight.mastered).toBe(1); // 10:1 is the knight variant
    expect(result.master.mastered).toBe(1); // 11:0 is the master variant
    expect(result.padawan.mastered).toBe(0);
  });

  it("ignores unknown ids and out-of-range variant indices", () => {
    const result = computeDykswuDatabank(["10:5", "77:0", "10:0"], dykswuPool);
    expect(result.padawan.mastered).toBe(1); // only 10:0 resolves
  });
});
