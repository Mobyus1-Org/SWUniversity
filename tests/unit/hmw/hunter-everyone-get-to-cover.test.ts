import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_035 Hunter — Everyone Get to Cover! (4/7 Ground, cost 6, Command/Vigilance/Heroism, Clone,
// unique) —
//   "When Played: Choose two. You may choose the same option more than once:
//      • Give a Shield token to a unit.
//      • Attack with a unit, even if it's exhausted. It can't attack bases for this attack."
//
// "You may choose the same option more than once" is what separates this from the existing
// choose-two cards (SOR_155 and friends), which REMOVE each mode as it is picked. Hunter's modes
// have to survive being chosen, so the second prompt still offers both.
//
// The attack mode is Chewbacca's (HMW_009) exactly: a unit that may be exhausted, restricted from
// bases for that attack via the shared `<cardId>_no_base` convention.

const HUNTER = "HMW_035";
const SHIELD = Cards.upgrades.token.shield;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, HUNTER)
    .WithActivePlayer(1);
}

const shieldsOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === SHIELD).length;

describe("HMW_035 Hunter — Everyone Get to Cover!", () => {
  it("can pick the SAME option twice — two Shield tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);

    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, marineIdx);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, marineIdx);

    expect(shieldsOn(g.state.player1.groundArena[marineIdx])).toBe(2);
  });

  it("offers BOTH options again on the second choice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, marineIdx);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Option");
    if (pending?.type === "Option") {
      expect(pending.options).toHaveLength(2); // the used mode was not consumed
    }
  });

  it("can shield an ENEMY unit — 'a unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(2, 0);

    expect(shieldsOn(g.state.player2.groundArena[0])).toBe(2);
  });

  it("attacks with a unit and CANNOT pick a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseOptionAsync(1, "attack");
    await g.chooseGroundUnitAsync(1, marineIdx);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Target");
    if (pending?.type === "Target") {
      expect(pending.fromZones ?? []).not.toContain("Base");
    }

    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(0); // never touched a base
  });

  it("HUNTER himself can attack, exhausted though he just landed", async () => {
    // "even if it's exhausted" — a unit enters play exhausted, so Hunter attacking off his own
    // When Played is the clearest test of that clause.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    const hunterIdx = g.state.player1.groundArena.findIndex(u => u.cardId === HUNTER);
    expect(g.state.player1.groundArena[hunterIdx].ready).toBe(false);

    await g.chooseOptionAsync(1, "attack");
    await g.chooseGroundUnitAsync(1, hunterIdx);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4); // Hunter's 4 power
  });

  it("mixes the two modes: shield then attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);

    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, marineIdx);
    await g.chooseOptionAsync(1, "attack");
    await g.chooseGroundUnitAsync(1, marineIdx);
    await g.chooseGroundUnitAsync(2, 0);

    // The Shield goes on the Marine, then the Marine attacks into a 3/7 — and the Shield eats the
    // 3 counter damage and is spent. Both modes landed: a bare Marine would have died here.
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(marine).toBeDefined();
    expect(marine.damage).toBe(0);
    expect(shieldsOn(marine)).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("asks exactly twice and then stops", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, marineIdx);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, marineIdx);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
