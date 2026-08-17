import { describe, expect, it } from "vitest";

import { segmentByCardRefs } from "@/util/puzzle-text";

/**
 * Puzzle text mixes two markups: `@[CARD_ID]` card references and the Quiz-style `**bold**` /
 * `_italic_` inline markup. Card ids contain underscores, so the refs MUST be carved out before
 * anything looks for `_`; these tests pin that ordering guarantee.
 */
describe("segmentByCardRefs", () => {
  it("returns a single text segment for plain text", () => {
    expect(segmentByCardRefs("Attack the base.")).toEqual([
      { kind: "text", value: "Attack the base." },
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(segmentByCardRefs("")).toEqual([]);
  });

  it("splits text around a single reference", () => {
    expect(segmentByCardRefs("Play @[TWI_229] now")).toEqual([
      { kind: "text", value: "Play " },
      { kind: "card", ref: expect.objectContaining({ cardId: "TWI_229" }) },
      { kind: "text", value: " now" },
    ]);
  });

  it("emits no empty text segments around a leading or trailing reference", () => {
    expect(segmentByCardRefs("@[TWI_229]")).toEqual([
      { kind: "card", ref: expect.objectContaining({ cardId: "TWI_229" }) },
    ]);
  });

  it("keeps adjacent references as two card segments with nothing between", () => {
    const segments = segmentByCardRefs("@[TWI_229]@[TWI_230]");
    expect(segments.map((s) => s.kind)).toEqual(["card", "card"]);
  });

  it("preserves the -L leader-unit flag on the ref", () => {
    const segments = segmentByCardRefs("Deploy @[TWI_005-L] first");
    expect(segments[1]).toMatchObject({ kind: "card", ref: { cardId: "TWI_005", showLeaderUnit: true } });
  });

  it("leaves an unclosed reference in the text as-is", () => {
    expect(segmentByCardRefs("Play @[TWI_229 and win")).toEqual([
      { kind: "text", value: "Play @[TWI_229 and win" },
    ]);
  });

  // The reason this function exists: a card id's underscores must never reach the italic parser.
  it("keeps an underscored card id inside its card segment, never the text", () => {
    const segments = segmentByCardRefs("Play @[SOR_001] then @[SOR_002]");
    const textJoined = segments.filter((s) => s.kind === "text").map((s) => s.value).join("");
    expect(textJoined).not.toContain("_");
    expect(segments.filter((s) => s.kind === "card")).toHaveLength(2);
  });

  it("hands surrounding bold markers to the text segments, unmangled", () => {
    expect(segmentByCardRefs("**@[SOR_001]**")).toEqual([
      { kind: "text", value: "**" },
      { kind: "card", ref: expect.objectContaining({ cardId: "SOR_001" }) },
      { kind: "text", value: "**" },
    ]);
  });

  it("keeps newlines in the text segments for the container to render", () => {
    const segments = segmentByCardRefs("Line one\nPlay @[SOR_001]\nLine three");
    expect(segments[0]).toEqual({ kind: "text", value: "Line one\nPlay " });
    expect(segments[2]).toEqual({ kind: "text", value: "\nLine three" });
  });

  it("passes through inline markup untouched when there are no refs", () => {
    expect(segmentByCardRefs("**Do not** attack — it has _Sentinel_.")).toEqual([
      { kind: "text", value: "**Do not** attack — it has _Sentinel_." },
    ]);
  });
});
