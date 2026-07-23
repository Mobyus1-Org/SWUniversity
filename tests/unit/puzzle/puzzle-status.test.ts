import { describe, it, expect } from "vitest";
import {
  puzzleStatusOf,
  visibleStatusesFor,
  isPuzzleVisibleTo,
  parsePuzzleStatus,
} from "@/server/puzzle/puzzle-status";

describe("puzzleStatusOf", () => {
  it("returns an explicit status when present", () => {
    expect(puzzleStatusOf({ status: "test" })).toBe("test");
    expect(puzzleStatusOf({ status: "deployed", deploy: false })).toBe("deployed");
  });

  it("falls back to legacy deploy when status is absent", () => {
    expect(puzzleStatusOf({ deploy: true })).toBe("deployed");
    expect(puzzleStatusOf({ deploy: false })).toBe("hidden");
  });

  it("defaults to hidden when neither field is set", () => {
    expect(puzzleStatusOf({})).toBe("hidden");
    expect(puzzleStatusOf({ status: null, deploy: null })).toBe("hidden");
  });

  it("ignores a garbage status string and falls back", () => {
    expect(puzzleStatusOf({ status: "bogus", deploy: true })).toBe("deployed");
  });
});

describe("visibleStatusesFor", () => {
  it("admin sees all three", () => {
    expect(visibleStatusesFor("admin")).toEqual(["hidden", "test", "deployed"]);
  });
  it("preview sees test and deployed", () => {
    expect(visibleStatusesFor("preview")).toEqual(["test", "deployed"]);
  });
  it("public sees only deployed", () => {
    expect(visibleStatusesFor("public")).toEqual(["deployed"]);
  });
});

describe("isPuzzleVisibleTo", () => {
  it("hides Hidden from public and preview but not admin", () => {
    expect(isPuzzleVisibleTo("hidden", "public")).toBe(false);
    expect(isPuzzleVisibleTo("hidden", "preview")).toBe(false);
    expect(isPuzzleVisibleTo("hidden", "admin")).toBe(true);
  });
  it("shows Test to preview and admin but not public", () => {
    expect(isPuzzleVisibleTo("test", "public")).toBe(false);
    expect(isPuzzleVisibleTo("test", "preview")).toBe(true);
    expect(isPuzzleVisibleTo("test", "admin")).toBe(true);
  });
  it("shows Deployed to everyone", () => {
    expect(isPuzzleVisibleTo("deployed", "public")).toBe(true);
    expect(isPuzzleVisibleTo("deployed", "preview")).toBe(true);
    expect(isPuzzleVisibleTo("deployed", "admin")).toBe(true);
  });
});

describe("parsePuzzleStatus", () => {
  it("accepts the three valid values", () => {
    expect(parsePuzzleStatus("hidden")).toBe("hidden");
    expect(parsePuzzleStatus("test")).toBe("test");
    expect(parsePuzzleStatus("deployed")).toBe("deployed");
  });
  it("rejects anything else", () => {
    expect(parsePuzzleStatus("Deployed")).toBeNull();
    expect(parsePuzzleStatus("")).toBeNull();
    expect(parsePuzzleStatus(true)).toBeNull();
    expect(parsePuzzleStatus(undefined)).toBeNull();
  });
});
