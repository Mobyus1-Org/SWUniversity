import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_149 Log Trap (Event, cost 2, Command, Trick) —
//   "Attack with a friendly unit. Then attack with it again, even if it's exhausted. It can't
//    attack bases for the second attack."
//
// The first attack is an ordinary "attack with a unit": only a ready unit may be chosen, and it
// may hit a base. The second attack ignores readiness but is restricted to units, so it only
// happens if the same unit survived the first attack AND still has an enemy unit it can attack.

const LOG_TRAP = Cards.events.hmw.logTrap;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground, no abilities
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 Ground, no abilities
const WAMPA = Cards.units.sor.wampa;               // 4/5 Ground Aggression, no abilities
const PIETT = Cards.units.ibh.admiralPiett;        // 2/5 — On Attack: with an Aggression unit, draw

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, LOG_TRAP)
    .WithActivePlayer(1);
}

const prompt = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as
  { type?: string; fromPlayIds?: string[]; fromZones?: string[] } | undefined;

/** Plays Log Trap and picks the attacker. */
async function playLogTrap(g: GameTestAdapter, attackerPlayId: string) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [attackerPlayId] });
}

describe("HMW_149 Log Trap", () => {
  it("attacks a base, then attacks a unit with the same, now exhausted, unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CSF).Build());

    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3);

    // The second attack: units only.
    const enemy = g.state.player2.groundArena[0];
    expect(prompt(g)?.type).toBe("Target");
    expect(prompt(g)?.fromPlayIds).toEqual([enemy.playId]);
    expect(prompt(g)?.fromZones ?? []).not.toContain("Base");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy.playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player1.groundArena[0].damage).toBe(3); // counter-damage from the second attack
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([LOG_TRAP]);
  });

  it("the second attack can't attack a base — a base attack is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CSF).Build());

    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.chooseBaseAsync(1, 2);
    await g.chooseBaseAsync(1, 2); // try the base again

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player2.base.damage).toBe(3);
    // The unit-only attack is still waiting to be made.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("the first attack may target a unit, and the second attack follows", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    const [enemyCsf, enemyMarine] = g.state.player2.groundArena;
    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyCsf.playId] });
    expect(prompt(g)?.fromPlayIds?.sort()).toEqual([enemyCsf.playId, enemyMarine.playId].sort());
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarine.playId] });

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CSF]); // the Marine died
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player1.groundArena[0].damage).toBe(6);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("the second attack respects Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, Cards.units.sec.cruelCommandos) // 5/5 Sentinel
        .Build(),
    );

    const sentinel = g.state.player2.groundArena[1];
    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [sentinel.playId] });

    expect(prompt(g)?.fromPlayIds).toEqual([sentinel.playId]);
  });

  it("only the chosen unit attacks twice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, WAMPA)
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await playLogTrap(g, g.state.player1.groundArena[1].playId);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].ready).toBe(true);  // the Wampa never attacked
    expect(g.state.player1.groundArena[1].ready).toBe(false);
    expect(g.state.player1.groundArena[1].damage).toBe(3);
  });

  it("no second attack when the attacker dies in the first", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, CSF, false) // another unit — must not take over the second attack
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([CSF]); // the Marine died
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("no second attack when the first one defeated the last enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).Build());

    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("no second attack when the only enemy units are in the other arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithSpaceUnitForPlayer(2, Cards.units.ibh.scoutingTieFighter)
        .Build(),
    );

    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("On Attack abilities fire on both attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, PIETT)
        .WithGroundUnitForPlayer(1, WAMPA) // the Aggression unit Piett needs
        .WithGroundUnitForPlayer(2, CSF)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)
        .Build(),
    );

    await playLogTrap(g, g.state.player1.groundArena[0].playId);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.hand).toHaveLength(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("an exhausted unit can't be chosen for the first attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF, false)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(prompt(g)?.type).toBe("Target");
    expect(prompt(g)?.fromPlayIds).toEqual([g.state.player1.groundArena[1].playId]);
  });

  it("does nothing when no friendly unit is ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF, false).WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([LOG_TRAP]);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
