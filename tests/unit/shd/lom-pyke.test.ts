import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { SmuggleCost, SmuggleAspects } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

// SHD_032 Lom Pyke — Dealer in Truths (4/6 Ground, cost 4, Villainy/Vigilance)
//   "On Attack: You may give a Shield token to an enemy unit. If you do, give a Shield token to a
//    friendly unit."
//   "Smuggle [5 resources Vigilance Villainy]"

const LOM = Cards.units.shd.lomPyke;
const MARINE = Cards.units.sor.battlefieldMarine;
const SHIELD = Cards.upgrades.token.shield;

const shields = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === SHIELD).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.idenVersio)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, LOM)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithActivePlayer(1);
}

describe("SHD_032 Lom Pyke", () => {
  it("has Smuggle [5 resources Vigilance Villainy]", () => {
    expect(SmuggleCost(LOM)).toBe(5);
    expect(SmuggleAspects(LOM)).toEqual(["Vigilance", "Villainy"]);
  });

  it("On Attack: a Shield to an enemy unit, then one to a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(shields(g.state.player2.groundArena[0])).toBe(1);
    expect(shields(g.state.player1.groundArena[1])).toBe(1);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("declined: nobody gets a Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(shields(g.state.player2.groundArena[0])).toBe(0);
    expect(shields(g.state.player1.groundArena[1])).toBe(0);
  });

  it("with no enemy unit, nothing is offered (no free friendly Shield)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.idenVersio)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, LOM)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(shields(g.state.player1.groundArena[0])).toBe(0);
  });
});
