import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

describe("LAW_233 Galen Erso", () => {
  it("When Played: can give control of Galen to the opponent", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.law.galenErso)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // give control to opponent

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.law.galenErso)).toBe(true);
  });

  it("grants enemy units (of Galen's controller) Raid 1 and Saboteur", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Galen controlled by player 2; player 1's Sandcrawler is therefore an "enemy unit"
      .WithGroundUnitForPlayer(2, Cards.units.law.galenErso)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .Build();
    g.loadNewState(state);

    const sandcrawler = g.state.player1.groundArena[0];
    expect(RaidAmount(sandcrawler.cardId, sandcrawler.playId, 1)).toBe(1);
    expect(HasSaboteur(sandcrawler.cardId, sandcrawler.playId, 1)).toBe(true);

    // Galen's own controller's units are NOT granted (Galen is not its own enemy)
    const galen = g.state.player2.groundArena[0];
    expect(HasSaboteur(galen.cardId, galen.playId, 2)).toBe(false);

    // And the Sandcrawler swings at +1 power from Raid (1 base + 1 raid)
    expect(Unit.FromInterface(sandcrawler).CurrentPower(true)).toBe(2);
  });
});
