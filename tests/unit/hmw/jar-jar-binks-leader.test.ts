import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_005 Jar Jar Binks — Bombad General (Leader, Vigilance/Heroism, Gungan; 4/5 Ground unit)
//   Front:    "Action [1 resource, Exhaust]: If you gave a token upgrade to a unit this phase, deal 1
//              damage to a unit and heal 1 damage from a base.
//              Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed: "Shielded (When you deploy this leader, give a Shield token to him.)
//              On Attack: If you gave a token upgrade to a unit this phase, you may deal 1 damage to
//              a unit and heal 1 damage from a base."
//
// "You gave" is about who GAVE the token — the opponent's gift doesn't count, and a token you give
// to an ENEMY unit does. Token UNITS (Battle Droids…) aren't token upgrades.

const JARJAR = Cards.leaders.hmw.jarJarBinks;
const SHIELDED = Cards.units.sor.wildernessFighter;   // 3-cost Ground, Shielded and nothing else
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const MARINE = Cards.units.sor.battlefieldMarine;

function base(resources = 10) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(JARJAR)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .FillResourcesForPlayer(2, MARINE, 10);
}

type Res = { type?: string; fromPlayIds?: string[]; fromZones?: string[] };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const useJarJar = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: JARJAR });

/** P1 plays a Shielded unit (P1 gives a Shield token), then P2 passes back. */
async function giveAShield(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(2, "pass-action", {});
}

describe("HMW_005 Jar Jar Binks — front Action", () => {
  it("after you gave a token upgrade: deal 1 damage to a unit, then heal 1 from a base", async () => {
    const g = new GameTestAdapter();
    const s = base().WithCardInHandForPlayer(1, SHIELDED).WithGroundUnitForPlayer(2, SECURITY).Build();
    s.player1.base.damage = 5;
    g.loadNewState(s);

    await giveAShield(g);
    const before = readyResources(g);
    await useJarJar(g);

    const unitStep = res(g);
    expect(unitStep.type).toBe("Target");
    // Any unit, either side — the Shielded unit is his own.
    expect([...(unitStep.fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId].sort(),
    );
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(1);

    await g.chooseBaseAsync(1, 1);
    expect(g.state.player1.base.damage).toBe(4);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(before - 1);
  });

  it("condition unmet: soft pass — the resource is still paid and the leader exhausted, nothing else", async () => {
    const g = new GameTestAdapter();
    const s = base().WithGroundUnitForPlayer(2, SECURITY).Build();
    s.player1.base.damage = 5;
    g.loadNewState(s);

    await useJarJar(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(9);
  });

  it("a token the OPPONENT gave doesn't count", async () => {
    const g = new GameTestAdapter();
    const s = base().WithActivePlayer(2).WithCardInHandForPlayer(2, SHIELDED).Build();
    s.player1.base.damage = 5;
    g.loadNewState(s);

    await g.playCardFromHandAsync(2, 0); // P2 gives their unit a Shield
    await useJarJar(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("with no unit in play it still heals the base", async () => {
    const g = new GameTestAdapter();
    const s = base().Build();
    s.player1.base.damage = 5;
    s.roundState.tokenUpgradesGivenThisPhase = [1];
    g.loadNewState(s);

    await useJarJar(g);
    expect(res(g).fromZones).toContain("Base");
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("the heal may go to either base", async () => {
    const g = new GameTestAdapter();
    const s = base().WithGroundUnitForPlayer(2, SECURITY).Build();
    s.player2.base.damage = 5;
    s.roundState.tokenUpgradesGivenThisPhase = [1];
    g.loadNewState(s);

    await useJarJar(g);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
  });

  it("can't be used with no resource to pay", async () => {
    const g = new GameTestAdapter();
    const s = base(0).Build();
    s.roundState.tokenUpgradesGivenThisPhase = [1];
    g.loadNewState(s);

    await useJarJar(g);

    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("deploys with 6 resources, not 5", async () => {
    const five = new GameTestAdapter();
    five.loadNewState(base(5).Build());
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBe(false);

    const six = new GameTestAdapter();
    six.loadNewState(base(6).Build());
    await six.deployLeaderAsync(1);
    expect(six.state.player1.leader.deployed).toBe(true);
    expect(six.state.player1.groundArena.some(u => u.cardId === JARJAR)).toBe(true);
  });
});

describe("HMW_005 Jar Jar Binks — deployed", () => {
  it("Shielded: deploying gives him a Shield — and that counts as a token you gave, arming his On Attack", async () => {
    const g = new GameTestAdapter();
    const s = base(6).WithGroundUnitForPlayer(2, SECURITY).Build();
    s.player1.base.damage = 5;
    g.loadNewState(s);

    await g.deployLeaderAsync(1);
    const jarjar = g.state.player1.groundArena.find(u => u.cardId === JARJAR)!;
    expect(jarjar.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield]);

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(res(g).type).toBe("Option");         // "you may"
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.base.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(4); // the attack itself
  });

  it("the On Attack can be declined", async () => {
    const g = new GameTestAdapter();
    const s = base(6).WithGroundUnitForPlayer(2, SECURITY).Build();
    s.player1.base.damage = 5;
    g.loadNewState(s);

    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(res(g).type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("no token given this phase: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(6)
      .MyLeader(JARJAR, true, true)
      .WithGroundUnitForPlayer(1, JARJAR)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(4);
  });
});

describe("'you gave a token upgrade to a unit this phase' — the record", () => {
  it("a Shield from your unit's Shielded counts; the phase record is per player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, SHIELDED).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.roundState.tokenUpgradesGivenThisPhase).toEqual([1]);
  });

  it("a Weakness you put on an ENEMY unit counts for you — not for the unit's controller", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .MyLeader(Cards.leaders.hmw.doctorHemlock) // "Action: Give a Weakness token to a unit…"
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].upgrades.map(u => u.cardId)).toEqual([Cards.units.token.weakness]);
    expect(g.state.roundState.tokenUpgradesGivenThisPhase).toEqual([1]);
  });

  it("creating token UNITS isn't giving a token upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.twi.battleDroidEscort).Build());

    await g.playCardFromHandAsync(1, 0); // creates a Battle Droid token unit

    expect(g.state.roundState.tokenUpgradesGivenThisPhase ?? []).toEqual([]);
  });

  it("the record ends with the phase", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(2, MARINE).WithCardInDeckForPlayer(2, MARINE)
      .Build();
    s.roundState.tokenUpgradesGivenThisPhase = [1];
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);
    expect(g.state.gamePhase).toBe("ActionPhase"); // the next round's action phase

    expect(g.state.roundState.tokenUpgradesGivenThisPhase).toEqual([]);
  });
});
