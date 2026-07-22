import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// QA bug reports (CR 34.4):
//  1. "Captured units that are rescued return to play under the control of the player who had
//      taken the unit captive, not its owner."
//  2. "Captured units disappear if the unit guarding them is defeated."
//
// P1 plays Take Captive so a P1 unit guards a P2 unit. The captive is OWNED by P2, so every
// release path must put it back into P2's arena.

function captureSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive);
}

/** P1's unit at ground index `captorIdx` captures P2's ground unit at index 0. */
async function doCapture(g: GameTestAdapter, captorIdx = 0) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseGroundUnitAsync(1, captorIdx);
  await g.chooseGroundUnitAsync(2, 0);
}

describe("Captives — release on guard defeat (CR 34.4)", () => {
  it("returns the captive to its OWNER's arena when the guard is defeated in combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      captureSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // captor
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // captive-to-be
        .WithGroundUnitForPlayer(2, Cards.units.sor.wampa) // executioner
        .Build(),
    );

    await doCapture(g);
    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
    expect(g.state.player2.groundArena.map(u => u.cardId))
      .not.toContain(Cards.units.sor.consularSecurityForce);

    // P2's Wampa (5 power) attacks and kills the captor Marine (3 HP).
    await g.dispatchAsync(1, "pass-action", {});
    const wampaIdx = g.state.player2.groundArena.findIndex(u => u.cardId === Cards.units.sor.wampa);
    await g.attackWithGroundUnitAsync(2, wampaIdx);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId))
      .not.toContain(Cards.units.sor.battlefieldMarine); // captor died
    // The captive must come back — to P2 (its owner), not to P1 (the captor's controller).
    const rescued = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce);
    expect(rescued, "captive vanished when its guard was defeated").toBeTruthy();
    expect(rescued!.controller).toBe(2);
    expect(rescued!.owner).toBe(2);
    expect(rescued!.ready).toBe(false); // returns exhausted
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.consularSecurityForce)).toBe(false);
  });

  it("returns the captive to its OWNER's arena when the guard is defeated by an ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      captureSetup()
        // Marine is 3/3; pre-damaged to 2 so P2's Daring Raid (2 damage) finishes it off.
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // captor
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithCardInHandForPlayer(2, Cards.events.shd.daringRaid)
        .Build(),
    );

    await doCapture(g);
    const captorPlayId = g.state.player1.groundArena[0].playId;
    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);

    await g.playCardFromHandAsync(2, 0); // Daring Raid the guard
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.playId === captorPlayId)).toBe(false);
    const rescued = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce);
    expect(rescued, "captive vanished when its guard was defeated").toBeTruthy();
    expect(rescued!.controller).toBe(2);
  });

  it("returns the captive to its OWNER's arena when the guard is bounced to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      captureSetup()
        .WithCardInHandForPlayer(1, Cards.events.sor.waylay)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // captor
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await doCapture(g);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Waylay the captor
    await g.chooseGroundUnitAsync(1, 0);

    const rescued = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce);
    expect(rescued, "captive vanished when its guard left play").toBeTruthy();
    expect(rescued!.controller).toBe(2);
  });
});

describe("Captives — on-demand rescue (L3-37)", () => {
  it("returns the rescued captive to its OWNER's control, not the captor's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      captureSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // captor
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // captive-to-be
        .WithCardInHandForPlayer(2, Cards.units.shd.l337)
        .Build(),
    );

    await doCapture(g);
    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);

    // P2 plays L3-37, whose When Played rescues a captured card.
    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2);

    const rescued = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce);
    expect(rescued, "rescued captive did not return to its owner's arena").toBeTruthy();
    expect(rescued!.controller).toBe(2);
    expect(rescued!.owner).toBe(2);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.consularSecurityForce)).toBe(false);
  });
});
