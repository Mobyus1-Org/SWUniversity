import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_072 Avenger — Hunting the Rebels (Unit 8/6 Space, cost 8, Vigilance/Villainy)
//   "When Played: Deal 1 damage to each other unit (including friendly units)."

const AVENGER = Cards.units.ibh.avengerHuntingTheRebels;
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const TIE = Cards.units.sor.tieLnFighter;              // 2/1 Space — dies to 1

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, AVENGER)
    .WithGroundUnitForPlayer(1, DURABLE)
    .WithGroundUnitForPlayer(2, DURABLE)
    .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer);
}

describe("IBH_072 Avenger — Hunting the Rebels", () => {
  it("deals 1 damage to every other unit, friendly and enemy, both arenas — not itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.spaceArena[0].damage).toBe(1);
    expect(g.state.player1.spaceArena.find(u => u.cardId === AVENGER)!.damage).toBe(0);
  });

  it("defeats units with 1 HP left, on both sides", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, TIE).WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([AVENGER]);
    expect(g.state.player2.spaceArena.some(u => u.cardId === TIE)).toBe(false);
  });

  it("a Shield absorbs the 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup().WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)]).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });
});
