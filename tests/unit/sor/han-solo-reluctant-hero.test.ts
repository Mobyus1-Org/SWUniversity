import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// SOR_198 Han Solo — Reluctant Hero (6/6 Ground, cost 7, Cunning/Heroism)
//   "Ambush"
//   "While attacking, this unit deals combat damage before the defender."
//
// A defender he defeats first never strikes back. Defending, he trades damage normally.

const HAN = Cards.units.sor.hanSoloReluctantHero;
const BIG = Cards.units.hmw.coastalCatamarans; // 8/8
const ARMY = Cards.units.hmw.grandArmyMarine;  // 2/2

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.idenVersio)
    .WithActivePlayer(1);
}

describe("SOR_198 Han Solo — Reluctant Hero", () => {
  it("has Ambush", () => {
    expect(HasAmbush(HAN)).toBe(true);
  });

  it("attacking, he defeats a 6-HP defender before it deals its counter-damage", async () => {
    const g = new GameTestAdapter();
    const state = setup().WithGroundUnitForPlayer(1, HAN).WithGroundUnitForPlayer(2, BIG, true, 2).Build(); // 8/8 with 2 damage
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("defending, damage is simultaneous", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, ARMY).WithGroundUnitForPlayer(2, HAN).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2); // the 2/2 still hit him
  });
});
