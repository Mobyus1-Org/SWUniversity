import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_172 Twin Laser Turret (Upgrade +2/+2, cost 2, Aggression)
//   "Attach to a Vehicle unit.
//    Attached unit gains: 'On Attack: Deal 1 damage to each of up to 2 units in this arena.'"
//
// "This arena" is the one the attacker is in; any units there count — friendly ones and the
// attacker itself included — and choosing none is allowed.

const TURRET = Cards.upgrades.jtl.twinLaserTurret;
const BLASTER = Cards.upgrades.sor.hardpointHeavyBlaster; // another Vehicle upgrade with an On Attack
const AWING = Cards.units.jtl.phoenixSquadronAWing;       // 3/2 Space Vehicle
const WAYFARER = Cards.units.lof.hyperspaceWayfarer;      // 4/10 Space
const MARINE = Cards.units.sor.battlefieldMarine;         // Ground, not a Vehicle
const up = (id: string, p: 1 | 2) => GameStateBuilder.Upgrade(id, p);

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10);
}

function armed() {
  return base()
    .WithSpaceUnitForPlayer(1, AWING)
    .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)]);
}

type TargetRes = { type: string; fromPlayIds?: string[]; needsMultiple?: boolean; maxTargets?: number };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as TargetRes;

describe("JTL_172 Twin Laser Turret", () => {
  it("attaches only to a Vehicle unit — on either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithCardInHandForPlayer(1, TURRET)
      .WithSpaceUnitForPlayer(1, AWING)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithSpaceUnitForPlayer(2, AWING)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect([...(res(g).fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId].sort(),
    );
  });

  it("On Attack: 1 damage to each of 2 chosen units in the attacker's arena, then the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(armed().WithSpaceUnitForPlayer(2, WAYFARER).WithSpaceUnitForPlayer(2, WAYFARER).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const r = res(g);
    expect(r.type).toBe("Target");
    expect(r.needsMultiple).toBe(true);
    expect(r.maxTargets).toBe(2);

    const [a, b] = g.state.player2.spaceArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a, b] });

    expect(g.state.player2.spaceArena.map(u => u.damage)).toEqual([1, 1]);
    expect(g.state.player2.base.damage).toBe(5); // A-Wing 3 + Turret 2
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("offers only units in the attacker's arena — its own side and itself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(armed()
      .WithSpaceUnitForPlayer(1, WAYFARER)
      .WithSpaceUnitForPlayer(2, WAYFARER)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect([...(res(g).fromPlayIds ?? [])].sort()).toEqual([
      g.state.player1.spaceArena[0].playId,
      g.state.player1.spaceArena[1].playId,
      g.state.player2.spaceArena[0].playId,
    ].sort());
  });

  it("a ground Vehicle hits ground units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.atStRaider)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(TURRET, 1)])
      .WithGroundUnitForPlayer(2, MARINE)
      .WithSpaceUnitForPlayer(2, AWING)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect([...(res(g).fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId].sort(),
    );
  });

  it("choosing none is allowed — the attack still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(armed().WithSpaceUnitForPlayer(2, WAYFARER).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const after = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(after.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("the same unit can't be hit twice, and a Shield absorbs its 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(armed()
      .WithSpaceUnitForPlayer(2, WAYFARER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(Cards.upgrades.token.shield, 2)])
      .WithSpaceUnitForPlayer(2, WAYFARER)
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const [shielded, plain] = g.state.player2.spaceArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [plain, plain] });

    expect(g.state.player2.spaceArena[1].damage).toBe(1);
    expect(g.state.player2.spaceArena[0].upgrades).toHaveLength(1);
    void shielded;
  });

  it("with another upgrade that also asks for input, both resolve before combat", async () => {
    // Previously only the first interactive upgrade On Attack was kept; the second was dropped.
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, AWING)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1), up(BLASTER, 1)]) // 3/2 → 7/6
      .WithSpaceUnitForPlayer(2, WAYFARER)
      .WithSpaceUnitForPlayer(2, WAYFARER)
      .Build());
    const [def, other] = g.state.player2.spaceArena.map(u => u.playId);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // Twin Laser Turret first…
    expect(res(g).needsMultiple).toBe(true);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [other] });
    // …then Hardpoint Heavy Blaster's "you may deal 2 damage to a unit in the defender's arena".
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [other] });

    const byId = (id: string) => g.state.player2.spaceArena.find(u => u.playId === id)!;
    expect(byId(other).damage).toBe(3);   // 1 + 2
    expect(byId(def).damage).toBe(7);     // combat: 3 + 2 + 2
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
