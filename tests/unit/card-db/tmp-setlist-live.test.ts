import { describe, it, expect } from "vitest";
import { fetchPreviewSetListAsync } from "@/server/engine/card-db/preview-client";
import { CardTitle } from "@/server/engine/card-db/generated";

// TEMPORARY: live check of the set listing. Deleted after running.
describe("live set listing", () => {
  it("lists the Normal group only and every id resolves in our dictionaries", async () => {
    const rows = await fetchPreviewSetListAsync("ASH");
    console.log("COUNT", rows.length);
    console.log("FIRST", JSON.stringify(rows[0]));
    console.log("LAST", JSON.stringify(rows[rows.length - 1]));

    // ASH is fully released, so every listed id must already exist in generated.ts. Any miss means
    // the id construction (padding, set code) is wrong.
    const missing = rows.filter((row) => CardTitle(row.cardId) === "");
    console.log("MISSING", JSON.stringify(missing.slice(0, 10)));
    expect(missing).toHaveLength(0);

    const duplicates = rows.length - new Set(rows.map((r) => r.cardId)).size;
    expect(duplicates).toBe(0);
  }, 60000);

  it("returns an empty list for a set code that does not exist", async () => {
    expect(await fetchPreviewSetListAsync("ZZZ")).toEqual([]);
  }, 30000);
});
