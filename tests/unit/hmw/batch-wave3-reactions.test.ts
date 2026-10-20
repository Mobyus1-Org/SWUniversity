import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Wave 3 — four watchers that react to something happening elsewhere on the board.
//
//   HMW_045 Logray              1/5 Ground  "When ANOTHER friendly unit that costs 3 or less is
//                                            dealt damage: You may deal 1 damage to an enemy unit."
//   HMW_119 Saw Gerrera         3/6 Ground  "When an OPPONENT plays an EVENT: Resource the top
//                                            card of your deck."
//   HMW_124 Luminara Unduli     7/7 Ground  "When you play a unit (INCLUDING THIS ONE): You may
//                                            attack with a unit. It gets +2/+0 for this attack."
//   HMW_113 Sinister War Memorial  Fortify  "Attached base gains: When a friendly unit is
//                                            defeated: Heal 1 damage from this base."
const LOGRAY = Cards.units.hmw.logray;
const SAW = Cards.units.hmw.sawGerrera;
const LUMINARA = Cards.units.hmw.luminaraUnduli;
const MEMORIAL = Cards.upgrades.hmw.sinisterWarMemorial;
const MARINE = Cards.units.sor.battlefieldMarine;       // cost 2 — "3 or less"
const TURTLE = Cards.units.ash.dinosaurTurtle;          // cost 6 — too expensive for Logray
const DAMAGE_EVENT = Cards.events.shd.daringRaid;       // "Deal 2 damage to a unit or base"

function base(myBaseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, myBaseDamage)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;

describe("HMW_045 Logray — reacts to a cheap friendly unit taking damage", () => {
  /** Logray plus a cheap friendly, and an enemy to shoot at. P2 damages the cheap friendly. */
  function setup(friendly: string) {
    return base()
      .WithGroundUnitForPlayer(1, LOGRAY)
      .WithGroundUnitForPlayer(1, friendly)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, DAMAGE_EVENT)
      .WithActivePlayer(2);
  }
  /** P2 plays a damage event at P1's second ground unit. */
  async function damageFriendly(g: GameTestAdapter) {
    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });
  }

  it("offers 1 damage to an enemy unit when a cheap friendly is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(MARINE).Build());

    await damageFriendly(g);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(MARINE).Build());

    await damageFriendly(g);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does NOT fire for a friendly unit costing more than 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(TURTLE).Build());

    await damageFriendly(g);

    expect(needs(g)).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does NOT fire for Logray himself — the text says 'another'", async () => {
    const g = new GameTestAdapter();
    // Logray is cost 2, so without the self-exclusion his own damage would trigger it.
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LOGRAY)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, DAMAGE_EVENT)
      .WithActivePlayer(2)
      .Build());

    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(needs(g)).toBeUndefined();
  });

  it("does NOT fire for a damaged ENEMY unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LOGRAY)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, DAMAGE_EVENT)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(needs(g)).toBeUndefined();
  });
});

describe("HMW_119 Saw Gerrera — reacts to an opponent's event", () => {
  function setup() {
    return base()
      .WithGroundUnitForPlayer(1, SAW)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithCardInHandForPlayer(2, DAMAGE_EVENT)
      .WithCardInDeckForPlayer(2, MARINE)
      .WithCardInDeckForPlayer(1, TURTLE) // the card Saw will resource
      .WithActivePlayer(2);
  }

  it("resources the top of your deck when the opponent plays an event", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const resourcesBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(g.state.player1.resources).toHaveLength(resourcesBefore + 1);
    expect(g.state.player1.deck).toHaveLength(deckBefore - 1);
    expect(g.state.player1.resources.some(r => r.cardId === TURTLE)).toBe(true);
  });

  it("does NOT fire when YOU play the event — it must be an opponent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, SAW)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, DAMAGE_EVENT)
      .WithCardInDeckForPlayer(1, TURTLE)
      .Build());
    const resourcesBefore = g.state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.resources).toHaveLength(resourcesBefore);
  });

  it("does NOT fire when the opponent plays a UNIT", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, SAW)
      .WithCardInHandForPlayer(2, MARINE)
      .WithCardInDeckForPlayer(1, TURTLE)
      .WithActivePlayer(2)
      .Build());
    const resourcesBefore = g.state.player1.resources.length;

    await g.playCardFromHandAsync(2, 0);

    expect(g.state.player1.resources).toHaveLength(resourcesBefore);
  });
});

describe("HMW_124 Luminara Unduli — reacts to you playing a unit", () => {
  it("offers an attack with +2/+0 when you play another unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LUMINARA)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    // Luminara swings: 7 power + 2 = 9 into a 3/3.
    const lum = g.state.player1.groundArena.find(x => x.cardId === LUMINARA)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [lum.playId] });
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("fires on HER OWN entry — 'including this one'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, LUMINARA)
      .Build());

    await g.playCardFromHandAsync(1, 0); // Luminara herself enters
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const marine = g.state.player1.groundArena.find(x => x.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });
    await g.chooseGroundUnitAsync(2, 0);

    // 3 power + 2 = 5 into a 3/3 Marine.
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LUMINARA)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does NOT fire when the OPPONENT plays a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LUMINARA)
      .WithCardInHandForPlayer(2, MARINE)
      .WithActivePlayer(2)
      .Build());

    await g.playCardFromHandAsync(2, 0);

    expect(needs(g)).toBeUndefined();
  });
});

describe("HMW_113 Sinister War Memorial — the base heals on a friendly defeat", () => {
  function setup(myBaseDamage = 5) {
    return base(myBaseDamage)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: MEMORIAL, playId: "mem1", owner: 1, controller: 1 },
      ])
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, TURTLE); // 7/7 kills a 3/3
  }

  it("heals 1 from the attached base when a friendly unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0); // the Marine dies to the Turtle
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(4); // 5 - 1
  });

  it("does not heal when an ENEMY unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(5)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: MEMORIAL, playId: "mem1", owner: 1, controller: 1 },
      ])
      .WithGroundUnitForPlayer(1, TURTLE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0); // the enemy Marine dies
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(5); // untouched
  });

  it("does nothing without the upgrade on the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(5)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, TURTLE)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("cannot heal an undamaged base below zero", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.base.damage).toBe(0);
  });
});
