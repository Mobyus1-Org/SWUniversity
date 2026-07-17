import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// ASH_120 Warrior of Clan Kryze (2/3/2 Ground) — "While you control another exhausted unit,
// this unit gains Sentinel."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("ASH_120 Warrior of Clan Kryze", () => {
  it("gains Sentinel while controlling another exhausted unit", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.warriorOfClanKryze, true)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // exhausted
      .Build();
    g.loadNewState(state);

    const warrior = state.player1.groundArena[0];
    expect(HasKeyword(Cards.units.ash.warriorOfClanKryze, "Sentinel", warrior.playId, 1)).toBe(true);
  });

  it("does not gain Sentinel with no other exhausted unit (control)", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.warriorOfClanKryze, true)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true) // ready
      .Build();
    g.loadNewState(state);

    const warrior = state.player1.groundArena[0];
    expect(HasKeyword(Cards.units.ash.warriorOfClanKryze, "Sentinel", warrior.playId, 1)).toBe(false);
  });

  it("does not count itself as the other exhausted unit", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.warriorOfClanKryze, false) // exhausted itself
      .Build();
    g.loadNewState(state);

    const warrior = state.player1.groundArena[0];
    expect(HasKeyword(Cards.units.ash.warriorOfClanKryze, "Sentinel", warrior.playId, 1)).toBe(false);
  });
});
