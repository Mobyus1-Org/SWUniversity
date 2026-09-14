import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_180 Piercing Shot (Event, cost 3, Aggression)
//   "Defeat all Shield tokens on a unit. Deal 3 damage to that unit."

const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const MARINE = Cards.units.sor.battlefieldMarine;
const SHIELD = Cards.upgrades.token.shield;
const XP = Cards.upgrades.token.experience;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.piercingShot);
}

describe("JTL_180 Piercing Shot", () => {
  it("defeats both Shields, then the 3 damage lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2), GameStateBuilder.Upgrade(SHIELD, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const unit = g.state.player2.groundArena[0];
    expect(unit.upgrades).toHaveLength(0);
    expect(unit.damage).toBe(3);
  });

  it("other upgrades stay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(XP, 2), GameStateBuilder.Upgrade(SHIELD, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const unit = g.state.player2.groundArena[0];
    expect(unit.upgrades.map(u => u.cardId)).toEqual([XP]);
    expect(unit.damage).toBe(3);
  });

  it("with no Shield it simply deals 3 damage — and can defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("can target a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SHIELD, 1)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
