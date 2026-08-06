import { describe, it, expect } from "vitest";
import { moveItem } from "@/components/Shared/puzzle-builder-state";

// Board order is meaningful (arena order, hand order, the indices authored solutions are written
// against), so the builder reorders in place instead of forcing a delete-and-re-add.
describe("moveItem", () => {
  it("moves an item later", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("moves an item earlier", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("moves across more than one position", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, -3)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the list unchanged past the start", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, -1)).toBe(list);
  });

  it("returns the list unchanged past the end", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 2, 1)).toBe(list);
  });

  it("returns the list unchanged for an out-of-range source", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 5, -1)).toBe(list);
    expect(moveItem(list, -1, 1)).toBe(list);
  });

  it("does not mutate the input", () => {
    const list = ["a", "b", "c"];
    moveItem(list, 0, 1);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("preserves the whole object, not just an identifier", () => {
    const units = [
      { cardId: "A", damage: 1, upgrades: ["x"] },
      { cardId: "B", damage: 0, upgrades: [] },
    ];
    const moved = moveItem(units, 1, -1);
    expect(moved[0]).toBe(units[1]);
    expect(moved[1]).toEqual({ cardId: "A", damage: 1, upgrades: ["x"] });
  });
});
