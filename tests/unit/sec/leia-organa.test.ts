import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_004 Leia Organa — Of A Secret Bloodline (leader; deployed 4/7 Ground)
// FRONT:    "Action [1 resource, Exhaust]: Disclose Vigilance, Command, Aggression, Cunning, or
//            Heroism (reveal a card from your hand with this aspect icon). If you do, give an
//            Experience token to a unit that doesn't share an aspect with the disclosed card."
// DEPLOYED: "On Attack: You may disclose ... If you do, give an Experience token to a unit that
//            doesn't share an aspect with the disclosed card."

// Battlefield Marine (SOR_095): Command + Heroism.
// System Patrol Craft (SOR_066): Vigilance.
// Admiral Motti (SOR_226): Villainy — Villainy is NOT one of the five disclosable aspects.
const DISCLOSE_COMMAND_HEROISM = Cards.units.sor.battlefieldMarine;

function xpCount(unit: { upgrades: { cardId: string }[] }) {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length;
}

describe("SEC_004 Leia Organa — leader side Action", () => {
  it("discloses a card and gives XP to a unit that shares no aspect with it", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, DISCLOSE_COMMAND_HEROISM) // disclosing Command + Heroism
      // Patrol Craft is Vigilance — shares nothing with Command/Heroism → legal target.
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // disclose the Marine
    await g.chooseSpaceUnitAsync(1, 0); // give XP to the Patrol Craft

    expect(xpCount(g.state.player1.spaceArena[0])).toBe(1);
    expect(g.state.player1.hand).toHaveLength(1); // disclose reveals, it does not discard
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(7); // 1 resource paid
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a unit that SHARES an aspect with the disclosed card is not a legal target", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, DISCLOSE_COMMAND_HEROISM)
      // The only unit in play is another Marine — it shares Command + Heroism.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.useLeaderAbilityAsync(1);
    const disclosed = await g.chooseCardFromHandAsync(1, 0);

    // No legal target → the ability fizzles after the disclose, no token given.
    expect(disclosed.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(xpCount(g.state.player1.groundArena[0])).toBe(0);
  });

  it("is not available when the hand holds no disclosable aspect", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      // Admiral Motti is Villainy only — not one of the five disclosable aspects.
      .WithCardInHandForPlayer(1, Cards.units.sor.admiralMotti)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(xpCount(g.state.player1.spaceArena[0])).toBe(0);
  });

  it("rejects revealing a card with none of the five aspects", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.admiralMotti) // Villainy — illegal
      .WithCardInHandForPlayer(1, DISCLOSE_COMMAND_HEROISM) // legal
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.useLeaderAbilityAsync(1);
    const bad = await g.chooseCardFromHandAsync(1, 0); // try to disclose the Villainy card

    expect(bad.lastDispatchResponse?.invalidAction).toBe(true);
    expect(xpCount(g.state.player1.spaceArena[0])).toBe(0);
  });
});

describe("SEC_004 Leia Organa — deployed side On Attack", () => {
  it("may disclose on attack and give XP to a non-sharing unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.leiaOrgana, true, true) // deployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInHandForPlayer(1, DISCLOSE_COMMAND_HEROISM)
      .WithGroundUnitForPlayer(1, Cards.leaders.sec.leiaOrgana) // the leader unit
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vigilance → legal target
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1); // "You may disclose"
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(xpCount(g.state.player1.spaceArena[0])).toBe(1);
  });

  it("declining the deployed disclose gives no token", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.leiaOrgana, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInHandForPlayer(1, DISCLOSE_COMMAND_HEROISM)
      .WithGroundUnitForPlayer(1, Cards.leaders.sec.leiaOrgana)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const attacked = await g.chooseBaseAsync(1, 2);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(attacked.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(xpCount(g.state.player1.spaceArena[0])).toBe(0);
    expect(g.state.player1.hand).toHaveLength(1);
  });
});
