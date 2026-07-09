import { describe, it, expect } from "vitest";
import { normalizePuzzleAssetPath, puzzleImageSrc, DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";

describe("normalizePuzzleAssetPath", () => {
  it("files a bare filename under puzzles/", () => {
    expect(normalizePuzzleAssetPath("mandalore.png")).toBe("puzzles/mandalore.png");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizePuzzleAssetPath("  hero.jpg  ")).toBe("puzzles/hero.jpg");
  });

  it("leaves an explicit relative path untouched", () => {
    expect(normalizePuzzleAssetPath("puzzles/x.png")).toBe("puzzles/x.png");
  });

  it("strips a leading slash from an explicit path", () => {
    expect(normalizePuzzleAssetPath("/puzzles/x.png")).toBe("puzzles/x.png");
  });

  it("returns empty string for blank input (so the default applies)", () => {
    expect(normalizePuzzleAssetPath("")).toBe("");
    expect(normalizePuzzleAssetPath("   ")).toBe("");
  });
});

describe("puzzleImageSrc", () => {
  it("falls back to the default card back when unset or empty", () => {
    expect(puzzleImageSrc(undefined)).toBe(`/assets/${DEFAULT_PUZZLE_IMAGE}`);
    expect(puzzleImageSrc("")).toBe(`/assets/${DEFAULT_PUZZLE_IMAGE}`);
    expect(DEFAULT_PUZZLE_IMAGE).toBe("SWUniversity_Cardback.png");
  });

  it("builds an /assets/ URL from a stored relative path", () => {
    expect(puzzleImageSrc("puzzles/mandalore.png")).toBe("/assets/puzzles/mandalore.png");
  });
});
