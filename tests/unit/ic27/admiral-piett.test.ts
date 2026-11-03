import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_020 is a reprint of IBH_060: same text and stats, so this mirrors IBH_060's tests.

// IC27_020 Admiral Piett (2/5 Ground, cost 4, Imperial Official, Vigilance/Villainy)
// "On Attack: If you control an Aggression unit, draw a card."

function setup(withAggressionUnit: boolean, piettId = Cards.units.ic27.admiralPiett) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, piettId)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine); // a card to draw
  if (withAggressionUnit) {
    // Surface Assault Bomber is an Aggression unit.
    b = b.WithSpaceUnitForPlayer(1, Cards.units.ibh.surfaceAssaultBomber);
  }
  return b;
}

describe("IC27_020 Admiral Piett — On Attack: draw if you control an Aggression unit", () => {
  it("draws a card when you control an Aggression unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true).Build());
    const before = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(before + 1);
  });

  it("control: no Aggression unit → no draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false).Build());
    const before = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(before);
  });

});
