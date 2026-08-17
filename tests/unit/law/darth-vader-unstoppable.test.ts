import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_011 Darth Vader — Unstoppable (leader; deployed 6/8 Ground, Force/Imperial/Sith)
// FRONT:    "Action [Exhaust, discard a card from your hand]: Deal 1 damage to a unit or base."
//           "Epic Action: If you control 7 or more resources, deploy this leader."
// DEPLOYED: "On Attack: Discard any number of cards from your hand. Deal damage to a unit or base
//            equal to the number of cards discarded this way."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.law.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("LAW_011 Darth Vader — leader side Action", () => {
  it("discards a card as the cost, then deals 1 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] }); // the discard cost
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("can deal the damage to a BASE instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("the discard is a COST — the ability is unavailable with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build());

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("LAW_011 Darth Vader — deployed side On Attack", () => {
  async function deployedVader(builder: GameStateBuilder) {
    const g = new GameTestAdapter();
    g.loadNewState(builder.Build());
    await g.deployLeaderAsync(1);
    return g;
  }

  it("discarding 2 cards deals 2 damage to the chosen unit", async () => {
    const g = await deployedVader(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce), // 3/7
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // Vader attacks the base; the On Attack resolves first
    // The discard step takes one card at a time and ends on its own once the hand is empty.
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("discarding nothing ('any number') deals no damage and asks for no target", async () => {
    const g = await deployedVader(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce),
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(6); // Vader's combat damage still lands
  });

  it("the damage may go to a base", async () => {
    const g = await deployedVader(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine),
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    for (let i = 0; i < 3; i++) await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    await g.chooseBaseAsync(1, 2);

    // 3 from the discard + 6 from Vader's combat damage.
    expect(g.state.player2.base.damage).toBe(9);
  });

  it("stopping part-way deals only what was actually discarded", async () => {
    const g = await deployedVader(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce),
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] }); // discard one…
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });  // …then stop
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("no prompt at all when his hand is empty (control)", async () => {
    const g = await deployedVader(
      baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce),
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);

    expect(afterTarget.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(6);
  });
});
