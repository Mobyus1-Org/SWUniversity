import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_028 Paz Vizsla — For a Brighter Future (Unit 4/7 Ground, cost 5, Vigilance/Command/Heroism)
//   "Sentinel
//    When Defeated: If this unit wasn't defeated by combat damage, create 2 Mandalorian tokens."

const PAZ = Cards.units.ash.pazVizslaBrighterFuture;
const LUKE = Cards.units.sor.lukeSkywalker; // 6/7
const MANDO = Cards.units.token.mandalorian;
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const mandos = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === MANDO);

describe("ASH_028 Paz Vizsla — For a Brighter Future", () => {
  it("has Sentinel — an attacker must choose him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithActivePlayer(2).WithGroundUnitForPlayer(1, PAZ).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, LUKE).Build());

    await g.attackWithGroundUnitAsync(2, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("defeated by an ability — creates 2 Mandalorian tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithActivePlayer(1).WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall).WithGroundUnitForPlayer(1, PAZ).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === PAZ)).toBe(false);
    expect(mandos(g)).toHaveLength(2);
  });

  it("killed by ability DAMAGE (not combat) — creates the tokens too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithActivePlayer(1).WithCardInHandForPlayer(1, Cards.events.shd.detentionBlockRescue)
        .WithGroundUnitForPlayer(1, PAZ, true, 4).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(mandos(g)).toHaveLength(2);
  });

  it("defeated by COMBAT damage — no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithActivePlayer(2).WithGroundUnitForPlayer(1, PAZ, true, 3).WithGroundUnitForPlayer(2, LUKE).Build());

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(mandos(g)).toHaveLength(0);
  });

  it("combat death while Gar Saxon grants his When Defeated — still no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, PAZ, true, 5) // 7 + 2 HP, 5 damage → Luke's 6 kills him
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 1)])
        .WithGroundUnitForPlayer(1, Cards.leaders.shd.garSaxon) // deployed Gar Saxon
        .WithGroundUnitForPlayer(2, LUKE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena.some(u => u.cardId === PAZ)).toBe(false);
    await g.chooseNoAsync(1); // decline Gar Saxon's "return an upgrade"

    expect(mandos(g)).toHaveLength(0);
  });

  it("combat death replayed by Thrawn — the replay creates no tokens either", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, PAZ, true, 3)
        .WithGroundUnitForPlayer(2, LUKE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy(); // Thrawn's offer
    await g.chooseYesAsync(1);

    expect(mandos(g)).toHaveLength(0);
  });
});
