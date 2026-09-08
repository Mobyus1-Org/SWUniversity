import { describe, it, expect } from "vitest";
import {
  deriveLanes, nextPriorityRank, isLegalTransition,
  type CardImplRow,
} from "@/server/cards-impl/status-board";

const row = (cardId: string, status: CardImplRow["status"], extra: Partial<CardImplRow> = {}): CardImplRow => ({
  cardId, status, updatedBy: "mobyu", updatedAt: "2026-09-02T00:00:00.000Z", ...extra,
});

const UNIVERSE = ["SOR_001", "SOR_002", "SOR_003", "SOR_004"];

describe("deriveLanes", () => {
  it("puts every card with no row in To Do", () => {
    expect(deriveLanes(UNIVERSE, [])).toEqual({
      todo: UNIVERSE, priority: [], "needs-work": [], done: [],
    });
  });

  it("removes a card from To Do once it has a non-todo row", () => {
    const lanes = deriveLanes(UNIVERSE, [row("SOR_002", "done")]);
    expect(lanes.todo).toEqual(["SOR_001", "SOR_003", "SOR_004"]);
    expect(lanes.done).toEqual(["SOR_002"]);
  });

  it("treats an explicit todo row as equivalent to no row", () => {
    // Priority -> To Do writes a row rather than deleting one; both must read the same.
    expect(deriveLanes(UNIVERSE, [row("SOR_002", "todo")]).todo).toEqual(UNIVERSE);
  });

  it("ignores a row for a card outside the universe", () => {
    // A retired or mistyped id must not conjure a lane entry.
    const lanes = deriveLanes(UNIVERSE, [row("ASHP_003", "done")]);
    expect(lanes.done).toEqual([]);
    expect(lanes.todo).toEqual(UNIVERSE);
  });

  it("orders Priority by priorityRank, not by card id", () => {
    const lanes = deriveLanes(UNIVERSE, [
      row("SOR_003", "priority", { priorityRank: 1 }),
      row("SOR_001", "priority", { priorityRank: 2 }),
    ]);
    expect(lanes.priority).toEqual(["SOR_003", "SOR_001"]);
  });

  it("sorts a rankless Priority row last, keeping order stable", () => {
    const lanes = deriveLanes(UNIVERSE, [
      row("SOR_004", "priority"),
      row("SOR_002", "priority", { priorityRank: 5 }),
    ]);
    expect(lanes.priority).toEqual(["SOR_002", "SOR_004"]);
  });
});

describe("nextPriorityRank", () => {
  it("starts at 1 on an empty board", () => {
    expect(nextPriorityRank([])).toBe(1);
  });

  it("appends after the highest existing rank", () => {
    expect(nextPriorityRank([
      row("SOR_001", "priority", { priorityRank: 3 }),
      row("SOR_002", "priority", { priorityRank: 7 }),
    ])).toBe(8);
  });

  it("ignores ranks on rows that are no longer in Priority", () => {
    expect(nextPriorityRank([row("SOR_001", "done", { priorityRank: 99 })])).toBe(1);
  });
});

describe("isLegalTransition", () => {
  // Exactly the table in the spec. Needs Work and Done can only swap with each other; neither
  // has a route back to To Do. This is a deliberate, recorded open question.
  it("allows every move out of To Do", () => {
    expect(isLegalTransition("todo", "priority")).toBe(true);
    expect(isLegalTransition("todo", "needs-work")).toBe(true);
    expect(isLegalTransition("todo", "done")).toBe(true);
  });

  it("allows every move out of Priority", () => {
    expect(isLegalTransition("priority", "todo")).toBe(true);
    expect(isLegalTransition("priority", "needs-work")).toBe(true);
    expect(isLegalTransition("priority", "done")).toBe(true);
  });

  it("allows only Needs Work -> Done", () => {
    expect(isLegalTransition("needs-work", "done")).toBe(true);
    expect(isLegalTransition("needs-work", "todo")).toBe(false);
    expect(isLegalTransition("needs-work", "priority")).toBe(false);
  });

  it("allows only Done -> Needs Work", () => {
    expect(isLegalTransition("done", "needs-work")).toBe(true);
    expect(isLegalTransition("done", "todo")).toBe(false);
    expect(isLegalTransition("done", "priority")).toBe(false);
  });

  it("treats a no-op move as legal", () => {
    expect(isLegalTransition("done", "done")).toBe(true);
  });
});
