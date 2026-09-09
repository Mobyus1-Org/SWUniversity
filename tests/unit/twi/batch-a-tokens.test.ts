import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// The token-making corner of TWI: three cards whose whole ability is "create N tokens", plus the
// two When Defeated cards that fire from the discard side of the board.
//
//   TWI_032 Wartime Trade Official — "When Defeated: Create a Battle Droid token."
//   TWI_144 Batch Brothers        — "When Played: Create a Clone Trooper token."
//   TWI_097 Captain Rex           — "When Played: Create 2 Clone Trooper tokens."
//   TWI_131 OOM-Series Officer    — "When Defeated: Deal 2 damage to a base."

const DROID = Cards.units.token.battleDroid;
const CLONE = Cards.units.token.cloneTrooper;
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa; // 4/5 — kills a small unit and survives

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

const count = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.filter(u => u.cardId === cardId).length;

/** Player 2's Wampa attacks and defeats player 1's unit at ground index 0. */
async function killP1Unit(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(2, 0);
  const victim = g.state.player1.groundArena[0].playId;
  await g.dispatchAsync(2, "choose-target", { targetPlayIds: [victim] });
}

describe("TWI_032 Wartime Trade Official", () => {
  it("creates a Battle Droid token for its controller when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.twi.wartimeTradeOfficial) // 1/3
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await killP1Unit(g);

    expect(count(g, 1, DROID)).toBe(1);
    expect(count(g, 2, DROID)).toBe(0);
  });

  it("makes no token while it is still alive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.twi.wartimeTradeOfficial).Build());

    expect(count(g, 1, DROID)).toBe(0);
  });
});

describe("TWI_144 Batch Brothers", () => {
  it("creates one Clone Trooper token when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.twi.batchBrothers).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(count(g, 1, CLONE)).toBe(1);
    expect(count(g, 2, CLONE)).toBe(0);
  });
});

describe("TWI_097 Captain Rex — Lead by Example", () => {
  it("creates two Clone Trooper tokens when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.twi.captainRexLeadByExample).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(count(g, 1, CLONE)).toBe(2);
  });
});

describe("TWI_131 OOM-Series Officer", () => {
  it("deals 2 to a chosen base when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.twi.oomSeriesOfficer) // 2/1
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await killP1Unit(g);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("can be aimed at either base — the text says 'a base', not 'an enemy base'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.twi.oomSeriesOfficer)
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await killP1Unit(g);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds ?? []).toEqual(
      expect.arrayContaining(["player1.base", "player2.base"]),
    );
  });
});
