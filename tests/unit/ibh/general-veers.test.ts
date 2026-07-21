import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_068 General Veers (3/6 Ground, cost 5, Imperial Official, Aggression/Villainy)
// "When Played: If you control a Vigilance unit, deal 2 damage to an enemy base and heal 2 damage from your base."

function setup(veersId = Cards.units.ibh.generalVeers, withVigilanceUnit = true) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5) // 5 damage to heal from
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, veersId);
  if (withVigilanceUnit) b = b.WithSpaceUnitForPlayer(1, Cards.units.ibh.lambdaShuttle); // Vigilance
  return b;
}

describe("IBH_068 General Veers — When Played: conditional base damage + heal", () => {
  it("deals 2 to enemy base and heals 2 from your base when you control a Vigilance unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(2); // dealt 2
    expect(g.state.player1.base.damage).toBe(3); // 5 - 2 healed
  });

  it("control: no Vigilance unit → nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.generalVeers, false).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(5); // unhealed
  });

  it("alt printing IBH_088 behaves identically", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.generalVeersB).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(3);
  });
});
