import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Removing an upgrade can lower a unit's HP below the damage already marked on it. CR 8.5.1 —
// a unit with damage >= its remaining HP is defeated as a state-based action, so stripping the
// +1/+1 from an Experience token off a 3/3 Battlefield Marine sitting at 3 damage kills it.

function upgrade(cardId: string, player: 1 | 2) {
  return { cardId, playId: "@", owner: player, controller: player };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("defeating an upgrade that was keeping its host alive", () => {
  it("Confiscate: stripping an Experience token defeats a unit already at lethal damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        // 3/3 Marine + Experience = 4/4, marked with 3 damage: 1 HP remaining.
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 3)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upgrade(Cards.upgrades.token.experience, 2)])
        .WithCardInHandForPlayer(1, Cards.events.sor.confiscate)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Outer Rim Constable: same, through a When Played upgrade defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 3)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upgrade(Cards.upgrades.token.experience, 2)])
        .WithCardInHandForPlayer(1, Cards.units.sec.outerRimConstable)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Pegasus Tri-Wing: same, defeating a FRIENDLY upgrade off a friendly unit", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft, true, 4)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upgrade(Cards.upgrades.token.experience, 1)])
      .WithCardInHandForPlayer(1, Cards.units.ash.pegasusTriWing)
      .Build();
    g.loadNewState(state);
    const upgradePlayId = state.player1.spaceArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradePlayId] });

    // 3/4 System Patrol Craft + Experience = 4/5 at 4 damage; without the token it is dead.
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.systemPatrolCraft)).toBe(false);
  });

  it("Power Failure: defeating both upgrades kills the host and discards the tokens", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      // 3/3 Marine + 2 Experience = 5/5 at 4 damage: 1 HP remaining.
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 4)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        upgrade(Cards.upgrades.token.experience, 2),
        upgrade(Cards.upgrades.token.experience, 2),
      ])
      .WithCardInHandForPlayer(1, Cards.events.sor.powerFailure)
      .Build();
    g.loadNewState(state);
    const upgradeIds = state.player2.groundArena[0].upgrades.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player2.groundArena[0].playId] });

    expect(upgradeIds).toHaveLength(2);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
