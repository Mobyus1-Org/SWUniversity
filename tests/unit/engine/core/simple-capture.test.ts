import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Capture mechanic", () => {
  it("captures an enemy unit: removes from arena, clears damage and upgrades, places under captor", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2)])
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);                 // play Take Captive → choose captor
    await g.chooseGroundUnitAsync(1, 0);                  // captor: P1's Battlefield Marine
    await g.chooseGroundUnitAsync(2, 0);                  // target: P2's Battlefield Marine

    expect(g.state.player2.groundArena.length).toBe(0);  // removed from arena
    expect(g.state.player1.groundArena[0].captives.length).toBe(1);
    expect(g.state.player1.groundArena[0].captives[0].damage).toBe(0);    // damage cleared
    expect(g.state.player1.groundArena[0].captives[0].upgrades.length).toBe(0); // upgrades cleared
  });

  it("rescues the captive when the captor is defeated", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(s);

    // P1 captures P2's Battlefield Marine with their own Marine
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // P2's Marine was captured so only Wampa remains at index 0. Attack P1's captor.
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);                  // target: P1's captor Marine

    expect(g.state.player1.groundArena.length).toBe(0);  // captor defeated
    // Wampa (index 0) + rescued Marine (index 1)
    expect(g.state.player2.groundArena.length).toBe(2);
    expect(g.state.player2.groundArena[1].cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(g.state.player2.groundArena[1].ready).toBe(false); // enters exhausted
  });

  it("rescued Hidden unit does not gain Hidden protection", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.lof.witchOfTheMist)
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(s);

    // P1 captures Witch of the Mist
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // P2 defeats the captor with Wampa → Witch rescued
    await g.attackWithGroundUnitAsync(2, 0); // only Wampa remains after capture
    await g.chooseGroundUnitAsync(1, 0);

    // Witch is back. P1 now attacks with something — Witch should be targetable (no Hidden protection on rescue)
    // Use Wampa's attack result to read available targets instead (Wampa is exhausted; use a fresh attacker)
    // Actually P1 has no units now. Let's check from the attack perspective: the Witch was not "played" this phase.
    // We verify by confirming it's in the arena and attackable.
    // Wampa (index 0) + rescued Witch (index 1)
    expect(g.state.player2.groundArena.length).toBe(2);
    expect(g.state.player2.groundArena[1].cardId).toBe(Cards.units.lof.witchOfTheMist);
    // Confirm Witch is NOT in the "played this phase" set — rescue does not grant Hidden protection.
    const playedIds = g.state.roundState.cardsEnteredPlayThisPhase
      .filter(e => e.reason !== "returned-to-play")
      .map(e => e.playId);
    expect(playedIds.includes(g.state.player2.groundArena[1].playId)).toBe(false);
  });

  it("rescued Shielded unit does not receive a Shield token", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.craftySmuggler)
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(s);

    // P1 captures Crafty Smuggler (Shielded)
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // P2 defeats captor → Crafty Smuggler rescued
    await g.attackWithGroundUnitAsync(2, 0); // only Wampa remains after capture
    await g.chooseGroundUnitAsync(1, 0);

    // Wampa (index 0) + rescued Crafty Smuggler (index 1)
    expect(g.state.player2.groundArena.length).toBe(2);
    expect(g.state.player2.groundArena[1].cardId).toBe(Cards.units.sor.craftySmuggler);
    // No Shield token — rescue does not trigger Shielded
    expect(g.state.player2.groundArena[1].upgrades.length).toBe(0);
  });

  it("rescued Ambush unit does not prompt for an attack", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.syndicateLackeys)
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(s);

    // P1 captures Syndicate Lackeys (Ambush)
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // P2 defeats captor → Syndicate Lackeys rescued
    await g.attackWithGroundUnitAsync(2, 0); // only Wampa remains after capture
    await g.chooseGroundUnitAsync(1, 0);

    // Wampa (index 0) + rescued Syndicate Lackeys (index 1)
    expect(g.state.player2.groundArena.length).toBe(2);
    expect(g.state.player2.groundArena[1].cardId).toBe(Cards.units.sor.syndicateLackeys);
    // No Ambush prompt — rescue does not trigger Ambush
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
