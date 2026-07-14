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
    // Raw 1 - 2 = -1, but power can never go below 0 (CurrentPower clamps).
    expect(unit.CurrentPower()).toBe(0);
    expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(true);
  });

  // Regression: CurrentPower used to return -1 here, and dealBaseDamage does `damage += amount`
  // with no floor — so attacking the enemy base with this unit HEALED it.
  it("attacking a base with the debuffed unit deals 0 damage, never healing it", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP, 5) // 5 damage already on it
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.ash.nowhereToHide, playId: "@", owner: 1, controller: 1 },
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // unchanged — not healed to 4
  });
});
