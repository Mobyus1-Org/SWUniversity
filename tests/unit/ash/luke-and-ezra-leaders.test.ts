import { describe, it, expect } from "vitest";

import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   ASH_005 Luke Skywalker — I Can Save Him
//     Front:    "When a friendly unit's attack ends: You may exhaust this leader. If you do, heal
//                1 damage from that unit."
//     Deployed: "When a friendly unit's attack ends: Heal 2 damage from that unit or from your base."
//   ASH_013 Ezra Bridger — It's Now or Never
//     Front:    "When a friendly unit's attack ends: If it dealt 3+ COMBAT damage to a base, you
//                may exhaust this leader. If you do, give an Advantage token to a different unit."
//     Deployed: Saboteur, and the same rider without the exhaust.

const LUKE = Cards.leaders.ash.lukeSkywalkerICanSaveHim;
const EZRA = Cards.leaders.ash.ezraBridgerNowOrNever;
const ADVANTAGE = Cards.upgrades.token.advantage;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const WAMPA = Cards.units.sor.wampa;                    // 4/5, Overwhelm
const PORG = "LOF_254";                                 // 1/1

function base(leader: string, myBaseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, myBaseDamage)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const at = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};
const advantage = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  at(g, p, cardId)?.upgrades.filter(u => u.cardId === ADVANTAGE).length ?? 0;

describe("ASH_005 Luke Skywalker — front", () => {
  it("exhausts to heal 1 from the attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(LUKE).WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(2, MARINE).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, MARINE)!.playId] });
    await g.chooseYesAsync(1);

    expect(at(g, 1, SECURITY)!.damage).toBe(2); // took 3 counter, healed 1
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is optional — declining keeps him ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(LUKE).WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(2, MARINE).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, MARINE)!.playId] });
    await g.chooseNoAsync(1);

    expect(at(g, 1, SECURITY)!.damage).toBe(3);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("offers nothing when the attacker DIED — there is no unit left to heal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(LUKE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, WAMPA)!.playId] });

    expect(at(g, 1, MARINE)).toBeUndefined();
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("offers nothing when the attacker took no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(LUKE).WithGroundUnitForPlayer(1, SECURITY).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not fire on the OPPONENT's attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(LUKE)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [at(g, 1, SECURITY)!.playId] });

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});

describe("ASH_005 Luke Skywalker — deployed", () => {
  async function deployedBoard(myBaseDamage: number) {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(LUKE, myBaseDamage)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    return g;
  }

  it("heals 2 from the attacker, with no exhaust cost", async () => {
    const g = await deployedBoard(0);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === SECURITY);

    await g.attackWithGroundUnitAsync(1, idx);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, MARINE)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, SECURITY)!.playId] });

    expect(at(g, 1, SECURITY)!.damage).toBe(1); // 3 counter, healed 2
  });

  it("can heal YOUR BASE instead", async () => {
    const g = await deployedBoard(4);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === SECURITY);

    await g.attackWithGroundUnitAsync(1, idx);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, MARINE)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(2);
    expect(at(g, 1, SECURITY)!.damage).toBe(3); // untouched
  });

  it("still heals your base when the attacker died", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(LUKE, 4).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build(),
    );
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);

    await g.attackWithGroundUnitAsync(1, idx);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, WAMPA)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(at(g, 1, MARINE)).toBeUndefined();
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("fizzles cleanly when nothing is damaged", async () => {
    const g = await deployedBoard(0);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === SECURITY);

    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});

describe("ASH_013 Ezra Bridger — front", () => {
  it("exhausts to give an Advantage token after 3+ combat damage to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(EZRA).WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(1, MARINE).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // the 3/7 hits the base for 3
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, MARINE)!.playId] });

    expect(advantage(g, 1, MARINE)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("does not fire on only 2 combat damage to a base", async () => {
    // A 2-power unit with NO abilities of its own, so the absence of any prompt is unambiguous:
    // an attacker with its own On Attack would let a fired-then-declined Ezra look identical.
    const g = new GameTestAdapter();
    g.loadNewState(base(EZRA).WithGroundUnitForPlayer(1, "HMW_116").Build()); // 2/4, vanilla

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("counts Overwhelm excess as combat damage to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(EZRA)
        .WithGroundUnitForPlayer(1, WAMPA)   // 4 power, Overwhelm
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, PORG)    // 1/1 → 3 excess
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, PORG)!.playId] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, MARINE)!.playId] });

    expect(g.state.player2.base.damage).toBe(3);
    expect(advantage(g, 1, MARINE)).toBe(1);
  });

  it("does not fire when the attack hit a UNIT and no base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(EZRA).WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY)!.playId] });

    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("cannot give the token to the ATTACKER — it says a DIFFERENT unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(EZRA).WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(1, MARINE).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(at(g, 1, SECURITY)!.playId);
    expect(offered).toContain(at(g, 1, MARINE)!.playId);
  });
});

describe("ASH_013 Ezra Bridger — deployed", () => {
  it("has Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(EZRA).Build());
    await g.deployLeaderAsync(1);
    const ezra = g.state.player1.groundArena.find(u => u.cardId === EZRA)!;
    expect(HasSaboteur(EZRA, ezra.playId, 1)).toBe(true);
  });

  it("gives the token with no exhaust cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(EZRA).WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(1, MARINE).Build(),
    );
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === SECURITY);

    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, MARINE)!.playId] });

    expect(advantage(g, 1, MARINE)).toBe(1);
  });
});
