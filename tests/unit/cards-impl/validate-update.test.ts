import { describe, it, expect } from "vitest";
import { validateStatusUpdate } from "@/server/cards-impl/validate-update";

const inScope = (id: string) => id === "SOR_095" || id === "HMW_035";

describe("validateStatusUpdate", () => {
  it("accepts a well-formed update", () => {
    const result = validateStatusUpdate({ cardId: "SOR_095", status: "done" }, inScope);
    expect(result).toEqual({ ok: true, value: { cardId: "SOR_095", status: "done" } });
  });

  it("keeps a note on a needs-work update", () => {
    const result = validateStatusUpdate(
      { cardId: "SOR_095", status: "needs-work", note: "On Attack fires twice" }, inScope);
    expect(result).toEqual({
      ok: true,
      value: { cardId: "SOR_095", status: "needs-work", note: "On Attack fires twice" },
    });
  });

  it("rejects a card outside the universe", () => {
    const result = validateStatusUpdate({ cardId: "ASHP_003", status: "done" }, inScope);
    expect(result).toEqual({ ok: false, error: "Unknown cardId: ASHP_003" });
  });

  it("rejects an unrecognised status", () => {
    const result = validateStatusUpdate({ cardId: "SOR_095", status: "blocked" }, inScope);
    expect(result).toEqual({ ok: false, error: "Unknown status: blocked" });
  });

  it("rejects a missing cardId", () => {
    expect(validateStatusUpdate({ status: "done" }, inScope).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateStatusUpdate(null, inScope).ok).toBe(false);
    expect(validateStatusUpdate("SOR_095", inScope).ok).toBe(false);
  });

  it("drops a note that is not a string rather than storing junk", () => {
    const result = validateStatusUpdate({ cardId: "SOR_095", status: "done", note: 7 }, inScope);
    expect(result).toEqual({ ok: true, value: { cardId: "SOR_095", status: "done" } });
  });

  it("rejects a non-numeric priorityRank", () => {
    expect(validateStatusUpdate(
      { cardId: "SOR_095", status: "priority", priorityRank: "first" }, inScope).ok).toBe(false);
  });
});
