import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// The conditional "When Played" corner of TWI, plus Anakin's Coordinate-gated On Attack.
//
//   TWI_031 Rune Haako          — "If a friendly unit was defeated this phase, you may give a unit –1/–1."
//   TWI_137 Savage Opress       — "If you control fewer units (including this one) than an opponent, ready this unit."
//   TWI_160 Vanguard Droid Bomber — "If you control another Separatist unit, deal 2 damage to an enemy base."
//   TWI_147 Anakin Skywalker    — "Coordinate — On Attack: Draw a card."

const HAAKO = Cards.units.twi.runeHaako;                 // 3/2 Ground
const SAVAGE = Cards.units.twi.savageOpressMonster;      // 7/7 Ground
const BOMBER = Cards.units.twi.vanguardDroidBomber;      // 2/2 Space, Separatist
const ANAKIN = Cards.units.twi.anakinSkywalkerMaverickMentor; // 6/6 Ground
const SEPARATIST = Cards.units.twi.wartimeTradeOfficial; // Separatist
const MARINE = Cards.units.sor.battlefieldMarine;        // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce;  // 3/7
const WAMPA = Cards.units.sor.wampa;                     // 4/5

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

function unitOf(g: GameTestAdapter, p: 1 | 2, cardId: string) {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
}

/** Player 1 loses a unit this phase: their Marine attacks a Wampa and dies to the counter. */
async function loseAFriendlyUnit(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
  await g.dispatchAsync(2, "pass-action", {});
}

describe("TWI_031 Rune Haako — Scheming Second", () => {
  it("offers the debuff after a friendly unit died this phase, and applies it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)   // 3/3 dies to the Wampa's 4
        .WithGroundUnitForPlayer(2, WAMPA)
        .WithCardInHandForPlayer(1, HAAKO)
        .Build(),
    );
    await loseAFriendlyUnit(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [unitOf(g, 2, WAMPA)!.playId] });

    const wampa = Unit.FromInterface(unitOf(g, 2, WAMPA)!);
    expect(wampa.CurrentPower()).toBe(3);
    expect(wampa.TotalHP()).toBe(4);
  });

  it("is optional — declining leaves stats alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, WAMPA)
        .WithCardInHandForPlayer(1, HAAKO)
        .Build(),
    );
    await loseAFriendlyUnit(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(Unit.FromInterface(unitOf(g, 2, WAMPA)!).CurrentPower()).toBe(4);
  });

  it("offers nothing when no friendly unit died this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, WAMPA).WithCardInHandForPlayer(1, HAAKO).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(Unit.FromInterface(unitOf(g, 2, WAMPA)!).CurrentPower()).toBe(4);
  });
});

describe("TWI_137 Savage Opress — Monster", () => {
  it("readies himself when you control FEWER units than the opponent", async () => {
    const g = new GameTestAdapter();
    // After he lands: player 1 has 1 unit, player 2 has 2.
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithCardInHandForPlayer(1, SAVAGE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(unitOf(g, 1, SAVAGE)!.ready).toBe(true);
  });

  it("stays exhausted on EQUAL counts — he counts himself, so a tie is not 'fewer'", async () => {
    const g = new GameTestAdapter();
    // After he lands: 1 v 1.
    g.loadNewState(base().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, SAVAGE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(unitOf(g, 1, SAVAGE)!.ready).toBe(false);
  });

  it("stays exhausted when you control MORE units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(1, SAVAGE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(unitOf(g, 1, SAVAGE)!.ready).toBe(false);
  });
});

describe("TWI_160 Vanguard Droid Bomber", () => {
  it("deals 2 to the enemy base while you control another Separatist", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, SEPARATIST).WithCardInHandForPlayer(1, BOMBER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("does nothing without another Separatist — it is itself one, but the clause says ANOTHER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, BOMBER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(0);
  });

  it("is not satisfied by an ENEMY Separatist", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, SEPARATIST).WithCardInHandForPlayer(1, BOMBER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(0);
  });
});

describe("TWI_147 Anakin Skywalker — Maverick Mentor", () => {
  it("draws a card on attack while Coordinate is active (3+ friendly units)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ANAKIN)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithCardInDeckForPlayer(1, MARINE)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });

  it("draws nothing with only 2 friendly units — Coordinate is off", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ANAKIN)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(handBefore);
  });
});
