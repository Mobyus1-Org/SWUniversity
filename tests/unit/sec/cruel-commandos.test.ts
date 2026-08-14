import { describe, it, expect, beforeEach } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Cards } from "../../card-helpers";

// SEC_086 Cruel Commandos (5/5 Ground) — "Sentinel" + "Overwhelm". Keyword-only, so implementing
// it means registering both keywords. The LAW/ASH keyword sweep does not cover SEC.
describe("SEC_086 Cruel Commandos", () => {
  beforeEach(() => {
    // HasKeyword reaches into the live game (ASH_040 Poe Dameron's "all units lose Sentinel"),
    // so a game must exist even for these static, no-playId lookups.
    new GameTestAdapter().loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .Build(),
    );
  });

  it("has Sentinel", () => {
    expect(HasKeyword(Cards.units.sec.cruelCommandos, "Sentinel")).toBe(true);
  });

  it("has Overwhelm", () => {
    expect(HasKeyword(Cards.units.sec.cruelCommandos, "Overwhelm")).toBe(true);
  });
});
