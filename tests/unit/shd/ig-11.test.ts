import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_170 IG-11 — I Cannot Be Captured (Unit 6/5 Ground, cost 5, Aggression)
//   "If this unit would be captured, defeat him and deal 3 damage to each enemy ground unit
//    instead.
//    On Attack: You may deal 3 damage to a damaged ground unit."

const IG11 = Cards.units.shd.ig11;
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground
const SPACE = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space
const SHIELD = Cards.upgrades.token.shield;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

describe("SHD_170 IG-11 — capture replacement", () => {
  function captureSetup() {
    return base()
      .WithCardInHandForPlayer(1, Cards.events.shd.takeCaptiveShd)
      .WithGroundUnitForPlayer(1, DURABLE)   // the would-be captor
      .WithGroundUnitForPlayer(1, MARINE)    // another enemy (to IG-11) ground unit
      .WithSpaceUnitForPlayer(1, SPACE)      // enemy SPACE unit — untouched
      .WithGroundUnitForPlayer(2, IG11)
      .WithGroundUnitForPlayer(2, DURABLE);  // IG-11's own friendly ground unit — untouched
  }

  it("is defeated instead of captured, and deals 3 to each enemy ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(captureSetup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor
    await g.chooseGroundUnitAsync(2, 0); // IG-11

    // Not held — defeated into his owner's discard.
    expect(g.state.player1.groundArena[0].captives).toHaveLength(0);
    expect(g.state.player2.groundArena.some(u => u.cardId === IG11)).toBe(false);
    expect(g.state.player2.discard.some(c => c.cardId === IG11)).toBe(true);

    // 3 to each of P1's ground units — the would-be captor included; the 3/3 Marine dies.
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player1.discard.some(c => c.cardId === MARINE)).toBe(true);

    // Space and IG-11's own side are untouched.
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("a Shield absorbs the 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      captureSetup()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SHIELD, 1)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === SHIELD)).toBe(false);
  });

  it("control: any other unit is captured normally, with no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.shd.takeCaptiveShd)
        .WithGroundUnitForPlayer(1, DURABLE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });
});

describe("SHD_170 IG-11 — On Attack", () => {
  function attackSetup() {
    return base()
      .WithGroundUnitForPlayer(1, IG11)
      .WithGroundUnitForPlayer(2, DURABLE, true, 1); // damaged enemy ground unit
  }

  it("may deal 3 damage to a damaged ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("declining deals no damage and the attack still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("offers only DAMAGED GROUND units — undamaged and space units are excluded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attackSetup()
        .WithGroundUnitForPlayer(2, DURABLE)          // undamaged
        .WithSpaceUnitForPlayer(2, SPACE, true, 1)    // damaged, but space
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player2.groundArena[0].playId]);
  });

  it("no offer when no ground unit is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, IG11).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(6);
  });
});
