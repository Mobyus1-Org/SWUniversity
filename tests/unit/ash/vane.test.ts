import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_012 Vane — Quarrelsome Pirate (Leader, Aggression/Villainy; deployed 3/6 Ground)
//   Front: "Action [Exhaust, defeat a friendly upgrade]: Deal 2 damage to a base."
//   Deployed: "On Attack: You may defeat a friendly upgrade. If you do, deal 2 damage to the
//              defending unit or a base."
//
// A friendly upgrade is one you control — tokens included, a Fortify upgrade on your base
// included, an upgrade the OPPONENT played on your unit excluded.

const VANE = Cards.leaders.ash.vane;
const MARINE = Cards.units.sor.battlefieldMarine;
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7
const TRAINING = Cards.upgrades.sor.academyTraining;
const SHIELD = Cards.upgrades.token.shield;
const FORTIFY = Cards.upgrades.hmw.allianceShieldGenerator;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(VANE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 6);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];
const up = (cardId: string, controller: 1 | 2) => GameStateBuilder.Upgrade(cardId, controller);

describe("ASH_012 Vane — leader Action", () => {
  it("defeats a friendly upgrade, then deals 2 damage to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(TRAINING, 1)]).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === TRAINING)).toBe(true);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("your own base is a legal target too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1)]).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
  });

  it("offers tokens and Fortify upgrades you control — not an upgrade the opponent played on your unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1), up(TRAINING, 2)]) // Training played by the opponent
      .WithUpgradesOnBaseForPlayer(1, [up(FORTIFY, 1)])
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);

    const shield = g.state.player1.groundArena[0].upgrades.find(u => u.cardId === SHIELD)!.playId;
    const fortify = g.state.player1.base.upgrades![0].playId;
    expect([...offer(g)].sort()).toEqual([shield, fortify].sort());
  });

  it("a Fortify upgrade can be the one defeated — it goes to its owner's discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithUpgradesOnBaseForPlayer(1, [up(FORTIFY, 1)]).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.base.upgrades![0].playId] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === FORTIFY)).toBe(true);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("a token on a unit you took control of counts as yours", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 2)]).Build();
    state.player1.groundArena[0].owner = 2; // their Marine, with the Shield they gave it, now yours
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].upgrades[0].playId]);
  });

  it("no friendly upgrade — the Action can't be used", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("ASH_012 Vane — deployed On Attack", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const vaneIdx = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === VANE);

  function setup() {
    return base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(TRAINING, 1)])
      .WithGroundUnitForPlayer(2, DURABLE);
  }

  it("attacking a unit: may defeat a friendly upgrade, then deal 2 to the DEFENDER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, vaneIdx(g));
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0);

    const defender = g.state.player2.groundArena[0].playId;
    expect(offer(g)).toContain(defender);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defender] });

    expect(g.state.player2.groundArena[0].damage).toBe(2 + 3); // ability + Vane's combat damage
  });

  it("attacking a base: the 2 can go to either base, but no unit is offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, vaneIdx(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0);

    expect(offer(g)).toEqual([]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(2 + 3);
  });

  it("declining defeats nothing and deals nothing extra", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, vaneIdx(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.upgrades).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(3);
  });
});
