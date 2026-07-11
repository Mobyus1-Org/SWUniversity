import { describe, expect, it } from "vitest";

import { findOpenRef, isKnownCardId, parseCardRefs } from "@/util/card-ref";

describe("parseCardRefs", () => {
  it("returns nothing for text with no references", () => {
    expect(parseCardRefs("Attack with the droid.")).toEqual([]);
  });

  it("parses a single reference with its offsets", () => {
    const refs = parseCardRefs("Play @[TWI_T01] now");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      raw: "@[TWI_T01]",
      cardId: "TWI_T01",
      showLeaderUnit: false,
      start: 5,
      end: 15,
    });
  });

  it("parses several references in one line", () => {
    const refs = parseCardRefs("@[TWI_T01] attacks @[TWI_229] and @[TWI_230]");
    expect(refs.map((r) => r.cardId)).toEqual(["TWI_T01", "TWI_229", "TWI_230"]);
  });

  it("parses adjacent references", () => {
    const refs = parseCardRefs("@[TWI_T01]@[TWI_T02]");
    expect(refs.map((r) => r.cardId)).toEqual(["TWI_T01", "TWI_T02"]);
    expect(refs[1].start).toBe(10);
  });

  it("strips the -L suffix and flags the leader unit side", () => {
    const refs = parseCardRefs("Deploy @[TWI_005-L]");
    expect(refs[0].cardId).toBe("TWI_005");
    expect(refs[0].showLeaderUnit).toBe(true);
  });

  it("ignores an unclosed reference", () => {
    expect(parseCardRefs("Play @[TWI_T01 and win")).toEqual([]);
  });

  it("ignores a stray closing bracket", () => {
    expect(parseCardRefs("Play TWI_T01] and win")).toEqual([]);
  });

  it("parses a reference at the very start and end of the text", () => {
    const refs = parseCardRefs("@[TWI_T01]");
    expect(refs).toHaveLength(1);
    expect(refs[0].start).toBe(0);
    expect(refs[0].end).toBe(10);
  });
});

describe("findOpenRef", () => {
  it("finds an open reference with an empty query", () => {
    const text = "Play @[";
    expect(findOpenRef(text, text.length)).toEqual({ start: 5, query: "" });
  });

  it("finds an open reference with a partial query", () => {
    const text = "Play @[batt";
    expect(findOpenRef(text, text.length)).toEqual({ start: 5, query: "batt" });
  });

  it("returns null when the caret sits before the open reference", () => {
    const text = "Play @[batt";
    expect(findOpenRef(text, 2)).toBeNull();
  });

  it("returns null when the reference is already closed", () => {
    const text = "Play @[TWI_T01] now";
    expect(findOpenRef(text, text.length)).toBeNull();
  });

  it("returns null when the caret is inside a closed reference", () => {
    const text = "Play @[TWI_T01] now";
    expect(findOpenRef(text, 10)).toBeNull();
  });

  it("finds an open reference that follows a closed one", () => {
    const text = "@[TWI_T01] then @[clo";
    expect(findOpenRef(text, text.length)).toEqual({ start: 16, query: "clo" });
  });

  it("returns null when there is no reference at all", () => {
    expect(findOpenRef("just text", 4)).toBeNull();
  });
});

describe("isKnownCardId", () => {
  it("accepts a real card", () => {
    expect(isKnownCardId("TWI_229")).toBe(true);
  });

  it("accepts a token unit", () => {
    expect(isKnownCardId("TWI_T01")).toBe(true);
  });

  it("rejects the SWUDB-style token id", () => {
    expect(isKnownCardId("TTWI_T01")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isKnownCardId("")).toBe(false);
  });
});
