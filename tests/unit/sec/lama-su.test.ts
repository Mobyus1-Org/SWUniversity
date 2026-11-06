import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// SEC_003 Lama Su — We Modified Their Genetics (Leader, Vigilance/Villainy; unit side 3/7 Ground)
//   Front: "Action [Exhaust]: Play an upgrade from your hand on a friendly non-Vehicle unit. It costs
//           1 resource less. If you do, deal 1 damage to that unit.
//           Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "When this unit completes an attack (and survives): You may play an upgrade from your
//           discard pile on a friendly non-Vehicle unit. It costs 1 resource less."

const LAMA = Cards.leaders.sec.lamaSu;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const XWING = Cards.units.sor.allianceXWing;      // Vehicle
const RESILIENT = Cards.upgrades.sor.resilient;   // cost 1 Vigilance, +0/+3
const WAMPA = Cards.units.sor.wampa;

function board(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(LAMA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const targets = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Target" ? r.fromPlayIds ?? [] : []; };
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SEC_003 Lama Su — leader Action", () => {
  it("plays an upgrade from hand on a friendly non-Vehicle unit for 1 less, then deals 1 damage to it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING)
      .WithGroundUnitForPlayer(2, WAMPA).WithCardInHandForPlayer(1, RESILIENT).Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    expect(targets(g)).toEqual([marine]); // not the X-Wing, not the enemy
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    const host = g.state.player1.groundArena[0];
    expect(host.upgrades.map(u => u.cardId)).toEqual([RESILIENT]);
    expect(host.damage).toBe(1);
    expect(readyResources(g)).toBe(8); // 1 – 1 = free
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("not available without an upgrade in hand or a non-Vehicle friendly unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, RESILIENT).Build());
    expect(ActionAbilities(LAMA, 1)).not.toContain(LAMA);

    const g2 = new GameTestAdapter();
    g2.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA).Build());
    expect(ActionAbilities(LAMA, 1)).not.toContain(LAMA);
  });

  it("the discount is what makes it affordable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, RESILIENT).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(1);
  });
});

describe("SEC_003 Lama Su — deployed", () => {
  async function attackWithLama(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === LAMA));
    await g.chooseBaseAsync(1, 2);
  }

  it("after he survives an attack, may play an upgrade from the discard pile for 1 less, no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING)
      .WithCardInDiscardForPlayer(1, RESILIENT).Build());

    await attackWithLama(g);
    expect(g.state.player2.base.damage).toBe(3);
    expect(res(g)?.type).toBe("Option");
    await g.chooseOptionAsync(1, g.state.player1.discard[0].playId);
    const lama = g.state.player1.groundArena.find(u => u.cardId === LAMA)!.playId;
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;
    expect(new Set(targets(g))).toEqual(new Set([lama, marine]));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    const host = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(host.upgrades.map(u => u.cardId)).toEqual([RESILIENT]);
    expect(host.damage).toBe(0);
    expect(g.state.player1.discard).toHaveLength(0);
    expect(readyResources(g)).toBe(8);
  });

  it("an upgrade with its own When Played (Craving Power) doesn't cut the rest of the attack short", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(14).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle)
      .WithCardInDiscardForPlayer(1, Cards.upgrades.lof.cravingPower)
      .WithCardInHandForPlayer(1, Cards.events.shd.outflank).Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    const lama = g.state.player1.groundArena.find(u => u.cardId === LAMA)!.playId;
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;
    const turtle = g.state.player2.groundArena[0].playId;

    // Outflank: "Attack with 2 units (one at a time)." Lama Su goes first.
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [lama] });
    await g.chooseBaseAsync(1, 2);
    await g.chooseOptionAsync(1, g.state.player1.discard.find(c => c.cardId === Cards.upgrades.lof.cravingPower)!.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });
    // Craving Power's own When Played: damage equal to the Marine's power (3 + 2).
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [turtle] });
    expect(g.state.player2.groundArena[0].damage).toBe(5);

    // …and Outflank's second attack is still owed.
    expect(targets(g)).toEqual([marine]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3 + 5);
  });

  it("may decline", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, RESILIENT).Build());

    await attackWithLama(g);
    await g.chooseOptionAsync(1, "none");

    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([RESILIENT]);
    expect(res(g)).toBeFalsy();
  });

  it("no upgrade in the discard pile: nothing is asked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, WAMPA).Build());

    await attackWithLama(g);

    expect(res(g)).toBeFalsy();
  });

  it("not if he didn't survive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, RESILIENT).WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle).Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    const lama = g.state.player1.groundArena.find(u => u.cardId === LAMA)!;
    lama.damage = 1;

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.indexOf(lama));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(res(g)).toBeFalsy();
  });
});
