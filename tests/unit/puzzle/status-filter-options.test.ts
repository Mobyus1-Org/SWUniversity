import { describe, it, expect } from "vitest";
import { statusFilterOptionsFor, visibleStatusesFor } from "@/server/puzzle/puzzle-status";

// The puzzle list's status-filter buttons are derived from the viewer's access level, so they can
// never offer a status whose list would come back empty (the list endpoint filters by the same
// level). Admins slice by everything; preview users get a two-way All/Testing toggle; the public
// sees a single status, so no filter at all.
describe("puzzle list — status filter options by access level", () => {
  it("admins get every status", () => {
    expect(statusFilterOptionsFor("admin")).toEqual(["all", "hidden", "test", "deployed"]);
  });

  it("preview users get exactly All and Testing", () => {
    expect(statusFilterOptionsFor("preview")).toEqual(["all", "test"]);
  });

  it("public viewers get no filter", () => {
    expect(statusFilterOptionsFor("public")).toEqual([]);
  });

  it("never offers a status the viewer is not allowed to see", () => {
    for (const level of ["admin", "preview", "public"] as const) {
      const visible = visibleStatusesFor(level);
      const selectable = statusFilterOptionsFor(level).filter(v => v !== "all");
      for (const status of selectable) {
        expect(visible).toContain(status);
      }
    }
  });

  it("offers a filter only when there is more than one status to tell apart", () => {
    for (const level of ["admin", "preview", "public"] as const) {
      const options = statusFilterOptionsFor(level);
      if (visibleStatusesFor(level).length < 2) expect(options).toEqual([]);
      else expect(options.length).toBeGreaterThan(1);
    }
  });

  it("every option list that exists starts with 'all'", () => {
    for (const level of ["admin", "preview", "public"] as const) {
      const options = statusFilterOptionsFor(level);
      if (options.length > 0) expect(options[0]).toBe("all");
    }
  });
});
