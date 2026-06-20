import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

describe("ASH_198 Nowhere to Hide", () => {
  it("grants the attached unit Sentinel and -2 power", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Scavenging Sandcrawler is 1 power / 7 HP
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.ash.nowhereToHide, playId: "@", owner: 1, controller: 1 },
      ])
      .Build();
    g.loadNewState(state);

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    // Raw power 1 - 2 = -1; combat damage floors to 0, so the unit harmlessly trades.
    expect(unit.CurrentPower()).toBe(-1);
    expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(true);
  });
});
