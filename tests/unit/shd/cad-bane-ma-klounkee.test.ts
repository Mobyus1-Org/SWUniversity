import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_014 Cad Bane (leader) + SHD_229 Ma Klounkee.
//
// Ma Klounkee is an Underworld card, so playing it triggers Cad Bane's "When you play an Underworld
// card" reaction. An event must FULLY resolve before a reaction to it does (CR: the event's own
// ability finishes, then triggered abilities that reacted to the play resolve). Ma Klounkee is a
// two-step event — "Return a friendly non-leader Underworld unit to its owner's hand. If you do,
// deal 3 damage to a unit." — so BOTH steps must land before Cad Bane's prompt appears.
//
// The ordering matters in play: Cad Bane's damage must not be able to kill the unit Ma Klounkee is
// about to bounce or damage, and the bounce must not remove a unit Cad Bane's damage was aimed at.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.shd.cadBane)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("SHD_014 Cad Bane + SHD_229 Ma Klounkee", () => {
  it("fully resolves Ma Klounkee (bounce, then 3 damage) BEFORE Cad Bane's reaction", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
      .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer) // friendly Underworld — the bounce target
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // takes Ma Klounkee's 3
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa) // the unit P2 will feed to Cad Bane
      .Build();
    g.loadNewState(state);

    const securityForcePlayId = state.player2.groundArena[0].playId;
    const wampaPlayId = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);

    // Step 1 of the EVENT: bounce the friendly Underworld unit.
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.shd.hylobonEnforcer);

    // Step 2 of the EVENT: still the event resolving — Cad Bane must NOT have interrupted here.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [securityForcePlayId] });
    expect(g.state.player2.groundArena.find(u => u.playId === securityForcePlayId)!.damage).toBe(3);
    expect(g.state.player1.leader.ready).toBe(true); // Cad Bane not yet used

    // ONLY NOW does Cad Bane's reaction resolve.
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [wampaPlayId] });

    expect(g.state.player2.groundArena.find(u => u.playId === wampaPlayId)!.damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted as the cost
    // Ma Klounkee's damage is untouched by Cad Bane's separate ping.
    expect(g.state.player2.groundArena.find(u => u.playId === securityForcePlayId)!.damage).toBe(3);
  });

  it("still offers Cad Bane's reaction after Ma Klounkee fizzles for lack of an Underworld unit", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT Underworld — nothing to bounce
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(state);

    const wampaPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);

    // The event does nothing, but it was still PLAYED — the reaction triggers on the play.
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [wampaPlayId] });

    expect(g.state.player2.groundArena.find(u => u.playId === wampaPlayId)!.damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("declining Cad Bane leaves Ma Klounkee's full result intact", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
      .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    g.loadNewState(state);

    const securityForcePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [securityForcePlayId] });

    await g.chooseNoAsync(1); // decline Cad Bane

    expect(g.state.player2.groundArena.find(u => u.playId === securityForcePlayId)!.damage).toBe(3);
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.shd.hylobonEnforcer);
  });

  it("orders the DEPLOYED side's reaction after the event too (2 damage)", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
      .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives 3+2
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;

    const securityPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // event step 1: bounce
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [securityPlayId] }); // event step 2: 3 damage
    expect(g.state.player2.groundArena.find(u => u.playId === securityPlayId)!.damage).toBe(3);

    await g.chooseYesAsync(1); // only now: the deployed reaction
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [securityPlayId] });

    // 3 from Ma Klounkee + 2 from deployed Cad Bane.
    expect(g.state.player2.groundArena.find(u => u.playId === securityPlayId)!.damage).toBe(5);
  });

  it("lets Ma Klounkee bounce the unit Cad Bane would otherwise have hit", async () => {
    // The bounced unit is gone before Cad Bane's reaction, so P2 cannot feed it to him — proof the
    // event's whole resolution precedes the reaction rather than interleaving with it.
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
      .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(state);

    const bouncedPlayId = state.player1.groundArena[0].playId;
    const wampaPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // bounce own Enforcer
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampaPlayId] }); // 3 damage to Wampa

    await g.chooseYesAsync(1);
    // The opponent is genuinely being asked to pick one of THEIR units...
    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds;
    expect(targets).toBeDefined();
    expect(targets).toContain(wampaPlayId);
    // ...and the already-bounced unit is not among the choices.
    expect(targets).not.toContain(bouncedPlayId);
  });
});
