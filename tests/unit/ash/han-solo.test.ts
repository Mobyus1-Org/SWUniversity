import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// ASH_158 Han Solo (3/7 Ground, cost 4) — "Saboteur (When this unit attacks, ignore Sentinel and
// defeat the defender's Shields.)\nWhen Played: Deal 3 damage to this unit. Give 3 Advantage
// tokens to a unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_158 Han Solo — Saboteur", () => {
  it("has printed Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.ash.hanSolo).Build());
    const solo = g.state.player1.groundArena[0];
    expect(HasKeyword(Cards.units.ash.hanSolo, "Saboteur", solo.playId, 1)).toBe(true);
  });
});

describe("ASH_158 Han Solo — When Played", () => {
  it("deals 3 damage to itself and gives 3 Advantage tokens to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.hanSolo)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);

    const solo = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.hanSolo)!;
    expect(solo.damage).toBe(3);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(3);
  });

  it("can target itself for the Advantage tokens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.hanSolo)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const soloPlayId = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.hanSolo)!.playId;

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [soloPlayId] });

    const solo = g.state.player1.groundArena.find(u => u.playId === soloPlayId)!;
    expect(solo.damage).toBe(3);
    expect(solo.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(3);
  });
});
