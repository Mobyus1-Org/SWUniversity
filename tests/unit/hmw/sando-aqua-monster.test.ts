import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import type { NeedsTarget } from "@/lib/engine/message-types";

// HMW_094 Sando Aqua Monster (5/9 Ground, cost 8, Vigilance, Creature) —
//   "Grit"
//   "When Played: If you control a Naboo base, you may defeat any number of ground units with
//    combined power equal to or less than this unit's power. Deal damage to this unit equal to the
//    combined power of the defeated units."
//
// "Ground units" — either side, leaders included, and Sando himself (he says neither "other" nor
// "enemy"). The budget is read when the offer is made; the damage counts only units that were
// actually defeated. Choosing none is the decline.

const SANDO = Cards.units.hmw.sandoAquaMonster;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const GUNGAN = Cards.units.hmw.grandArmyMarine;   // 2/2
const XWING = Cards.units.token.xWing;            // space
const CHEWIE_JTL = Cards.units.jtl.chewbacca;     // can't be defeated by enemy card abilities

function setup(base: string = Cards.bases.hmw.greatGrassPlains) {
  return new GameStateBuilder()
    .MyBase(base)
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, SANDO)
    .WithActivePlayer(1);
}

const offer = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as NeedsTarget | undefined;
const sando = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === SANDO)!;

async function pick(g: GameTestAdapter, playIds: string[]) {
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: playIds });
}

describe("HMW_094 Sando Aqua Monster", () => {
  it("defeats ground units with combined power up to 5, then takes that much damage (Grit raises his power)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, GUNGAN).Build());

    await g.playCardFromHandAsync(1, 0);
    await pick(g, g.state.player2.groundArena.map(u => u.playId)); // 3 + 2 = 5

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(sando(g).damage).toBe(5);
    expect(Unit.FromInterface(sando(g)).CurrentPower()).toBe(10); // Grit
  });

  it("rejects a choice over budget", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await pick(g, g.state.player2.groundArena.map(u => u.playId)); // 6 > 5

    expect(g.state.player2.groundArena.length).toBe(2);

    // Refused, so the offer is still open: a legal answer now resolves it.
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena.length).toBe(1);
    expect(sando(g).damage).toBe(3);
  });

  it("choosing none is the decline: nothing defeated, no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(offer(g)?.type).toBe("Target");
    await pick(g, []);

    expect(g.state.player2.groundArena.length).toBe(1);
    expect(sando(g).damage).toBe(0);
  });

  it("offers ground units on both sides and Sando himself, never space units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, GUNGAN)
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const pool = offer(g)?.fromPlayIds ?? [];
    expect(pool).toContain(g.state.player1.groundArena[0].playId);
    expect(pool).toContain(sando(g).playId);
    expect(pool).toContain(g.state.player2.groundArena[0].playId);
    expect(pool).not.toContain(g.state.player1.spaceArena[0].playId);
  });

  it("without a Naboo base, nothing is offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.bases.hmw.duneSea).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena.length).toBe(1);
  });

  it("an enemy unit that can't be defeated by enemy abilities isn't offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CHEWIE_JTL).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)?.fromPlayIds ?? []).not.toContain(g.state.player2.groundArena[0].playId);
  });
});
