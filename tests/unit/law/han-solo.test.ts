import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// LAW_017 Han Solo — I Got a Really Good Feeling (Leader, Cunning/Heroism; unit side 4/5 Ground)
//   Front: "Action [Exhaust, defeat a friendly token]: Deal 1 damage to a unit.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Saboteur. On Attack: Defeat any number of friendly tokens. Deal damage to a unit equal
//           to the number of tokens defeated this way."
// A friendly token is a token unit, a token upgrade (Shield, Experience, Advantage) or a Credit
// token. Credits are a counter rather than a card, so they are chosen by number.

const HAN = Cards.leaders.law.hanSolo;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const TURTLE = Cards.units.ash.dinosaurTurtle;    // 7/7
const DROID = Cards.units.token.battleDroid;
const SHIELD = Cards.upgrades.token.shield;
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(HAN)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const targets = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Target" ? r.fromPlayIds ?? [] : []; };
const credits = (g: GameTestAdapter) => g.state.player1.supplemental.creditTokens ?? 0;

describe("LAW_017 Han Solo — leader Action", () => {
  it("defeats a friendly token unit as the cost, then deals 1 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, DROID).WithGroundUnitForPlayer(2, MARINE).Build());
    const droid = g.state.player1.groundArena[0].playId;
    const marine = g.state.player2.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([droid]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [droid] });
    expect(g.state.player1.groundArena).toHaveLength(0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a token upgrade is a friendly token too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SHIELD, 1)])
      .WithGroundUnitForPlayer(2, MARINE).Build());
    const shield = g.state.player1.groundArena[0].upgrades[0].playId;

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([shield]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shield] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("with only Credits, a Credit is the cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCreditsForPlayer(1, 2).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    expect(credits(g)).toBe(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("with both, the player picks which kind to defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCreditsForPlayer(1, 1).WithGroundUnitForPlayer(1, DROID).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    expect(res(g)?.type).toBe("Option");
    await g.chooseOptionAsync(1, "credit");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(credits(g)).toBe(0);
    expect(g.state.player1.groundArena).toHaveLength(1); // the droid survives
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("cannot be used without a friendly token; an enemy token doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DROID).WithCreditsForPlayer(2, 3).Build());

    expect(ActionAbilities(HAN, 1)).not.toContain(HAN);
  });
});

describe("LAW_017 Han Solo — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const hanIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === HAN);

  it("has Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);
    const han = g.state.player1.groundArena[hanIndex(g)];

    expect(HasSaboteur(HAN, han.playId, 1)).toBe(true);
  });

  it("On Attack: defeats any number of friendly tokens, Credits included, and deals that much damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, DROID)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(XP, 1), GameStateBuilder.Upgrade(SHIELD, 1)])
      .WithCreditsForPlayer(1, 2)
      .WithGroundUnitForPlayer(2, TURTLE).Build());
    await deployed(g);
    const droid = g.state.player1.groundArena.find(u => u.cardId === DROID)!.playId;
    const marineUnit = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    const [xp, shield] = marineUnit.upgrades.map(u => u.playId);

    await g.attackWithGroundUnitAsync(1, hanIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(new Set(targets(g))).toEqual(new Set([droid, xp, shield]));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [droid, xp] });
    expect(res(g)?.type).toBe("Option"); // how many Credits
    await g.chooseOptionAsync(1, "1");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3); // droid + Experience + 1 Credit
    expect(credits(g)).toBe(1);
    expect(g.state.player1.groundArena.map(u => u.cardId)).not.toContain(DROID);
    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.upgrades.map(u => u.cardId)).toEqual([SHIELD]);
    expect(g.state.player2.base.damage).toBe(4); // the attack still lands
  });

  it("may defeat none: no damage, and the attack carries on", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, DROID).WithGroundUnitForPlayer(2, TURTLE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, hanIndex(g));
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(DROID);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("with no friendly tokens, nothing is asked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, hanIndex(g));
    await g.chooseBaseAsync(1, 2);

    expect(res(g)).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(4);
  });
});
