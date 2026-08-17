import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_139 Battle Fury — Upgrade (Innate), cost 2, +3/+3
//   Attached unit gains: "On Attack: Discard a card from your hand."
//
// Mandatory and a drawback, not a benefit — the discard is not optional, and it fizzles silently
// on an empty hand rather than blocking the attack.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

function withFury() {
  return baseSetup()
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      GameStateBuilder.Upgrade(Cards.upgrades.lof.battleFury, 1),
    ]);
}

describe("LOF_139 Battle Fury", () => {
  it("grants +3/+3", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withFury().Build());

    const host = g.state.player1.groundArena[0];
    expect(Unit.FromInterface(host).CurrentPower()).toBe(6); // 3 + 3
    expect(Unit.FromInterface(host).TotalHP()).toBe(6);
  });

  it("On Attack: discards a card from hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withFury()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player2.base.damage).toBe(6); // the buffed attack still lands
  });

  it("fizzles harmlessly on an empty hand — the attack still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withFury().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);

    expect(afterTarget.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("control: the same unit without the upgrade discards nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(3);
  });
});
