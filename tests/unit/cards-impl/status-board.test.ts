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
  it("puts every card with no row in Not Implemented", () => {
    expect(deriveLanes(UNIVERSE, [])).toEqual({
      "not-implemented": UNIVERSE, todo: [], priority: [], done: [],
    });
  });

  it("removes a card from Not Implemented once it has a row", () => {
    const lanes = deriveLanes(UNIVERSE, [row("SOR_002", "done")]);
    expect(lanes["not-implemented"]).toEqual(["SOR_001", "SOR_003", "SOR_004"]);
    expect(lanes.done).toEqual(["SOR_002"]);
  });

  it("treats To Do as an EXPLICIT lane, not a synonym for having no row", () => {
    // This is the whole point of the four-lane split: a card only reaches To Do by being
    // deliberately triaged there.
    const lanes = deriveLanes(UNIVERSE, [row("SOR_002", "todo")]);
    expect(lanes.todo).toEqual(["SOR_002"]);
    expect(lanes["not-implemented"]).toEqual(["SOR_001", "SOR_003", "SOR_004"]);
  });

  it("reads a leftover row from a retired lane as Not Implemented rather than dropping the card", () => {
    // Guards the migration: a stale needs-work document must not blank a column.
    const stale = { ...row("SOR_002", "done"), status: "needs-work" } as unknown as CardImplRow;
    const lanes = deriveLanes(UNIVERSE, [stale]);
    expect(lanes["not-implemented"]).toContain("SOR_002");
    expect(lanes.done).toEqual([]);
  });

  it("ignores a row for a card outside the universe", () => {
    // A retired or mistyped id must not conjure a lane entry.
    const lanes = deriveLanes(UNIVERSE, [row("ASHP_003", "done")]);
    expect(lanes.done).toEqual([]);
    expect(lanes["not-implemented"]).toEqual(UNIVERSE);
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
  const LANES = ["not-implemented", "todo", "priority", "done"] as const;

  it("allows every move between every pair of lanes", () => {
    for (const from of LANES) {
      for (const to of LANES) {
        expect(isLegalTransition(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
  });

  it("specifically allows Done -> Priority, the route a buggy card takes back", () => {
    expect(isLegalTransition("done", "priority")).toBe(true);
  });

  it("treats a no-op move as legal", () => {
    expect(isLegalTransition("done", "done")).toBe(true);
  });
});
