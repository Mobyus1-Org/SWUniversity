import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_175 System Shock (Event, cost 1, Aggression)
//   "Defeat a non-leader upgrade attached to a unit. If you do, deal 1 damage to that unit."

const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3 Ground
const AWING = Cards.units.jtl.phoenixSquadronAWing;     // Vehicle — a pilot host
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
    .WithCardInHandForPlayer(1, Cards.events.jtl.systemShock);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_175 System Shock", () => {
  it("defeats the chosen upgrade and deals 1 damage to its unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.entrenched, 2)])
      .Build());
    const upgPlayId = g.state.player2.groundArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgPlayId] });

    const unit = g.state.player2.groundArena[0];
    expect(unit.upgrades).toHaveLength(0);
    expect(unit.damage).toBe(1);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(Cards.upgrades.sor.entrenched);
  });

  it("a token counts: defeating one of two Shields — the other Shield then absorbs the 1 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2), GameStateBuilder.Upgrade(SHIELD, 2)])
      .Build());
    const upgPlayId = g.state.player2.groundArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgPlayId] });

    const unit = g.state.player2.groundArena[0];
    expect(unit.upgrades).toHaveLength(0);
    expect(unit.damage).toBe(0);
  });

  it("removing an Experience token can make the 1 damage lethal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, MARINE, true, 2) // 3/3 +XP = 4/4 with 2 damage
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(XP, 2)])
      .Build());
    const upgPlayId = g.state.player2.groundArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgPlayId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("offers upgrades on either side, but not a leader Pilot", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(XP, 1)])
      .WithSpaceUnitForPlayer(2, AWING)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.leaders.jtl.lukeSkywalker, 2)])
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].upgrades[0].playId]);
  });

  it("no upgrades in play: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
