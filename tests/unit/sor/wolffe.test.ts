import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// SOR_160 Wolffe — Suspicious Veteran (3/2 Ground, cost 2, Aggression)
//   "Saboteur"
//   "When Played/On Attack: Bases can't be healed for this phase."
//
// Both bases, both players' healing. Restore is healing too, so it is shut off as well.

const WOLFFE = Cards.units.sor.wolffe;
const NUMA = Cards.units.hmw.numa; // Restore 1
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, 5)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithActivePlayer(1);
}

describe("SOR_160 Wolffe", () => {
  it("has Saboteur", () => {
    expect(HasSaboteur(WOLFFE)).toBe(true);
  });

  it("When Played: a Restore attack heals nothing for the rest of the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, WOLFFE).WithGroundUnitForPlayer(1, NUMA).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0); // Numa, Restore 1
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("On Attack: same effect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, WOLFFE).WithGroundUnitForPlayer(1, NUMA).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("control: without Wolffe, the Restore attack heals 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, NUMA).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4);
  });
});
