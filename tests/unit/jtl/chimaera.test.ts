import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_039 Chimaera (5/6 Space, cost 6)
// "When Played: You may use a 'When Defeated' ability on another friendly unit."
// "When Defeated: Create 2 TIE Fighter tokens."

function playSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Chimaera costs 6 and its aspects are off-aspect here, so leave room for the penalty.
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithCardInHandForPlayer(1, Cards.units.jtl.chimaera);
}

function tieCount(g: GameTestAdapter) {
  return g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.tieFighter).length;
}

describe("JTL_039 Chimaera — When Played", () => {
  it("uses a friendly unit's When Defeated ability without defeating it", async () => {
    const g = new GameTestAdapter();
    // Battle Droid Escort — "When Defeated: Create a Battle Droid token."
    const s = playSetup().WithGroundUnitForPlayer(1, Cards.units.twi.battleDroidEscort).Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // the Escort

    const droids = g.state.player1.groundArena.filter(
      u => u.cardId === Cards.units.token.battleDroid,
    );
    expect(droids).toHaveLength(1); // its When Defeated ability fired
    // The Escort is NOT defeated — the ability is used, not the unit.
    expect(
      g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.battleDroidEscort),
    ).toBe(true);
  });

  it("declining uses no ability", async () => {
    const g = new GameTestAdapter();
    const s = playSetup().WithGroundUnitForPlayer(1, Cards.units.twi.battleDroidEscort).Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(
      g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.battleDroid),
    ).toHaveLength(0);
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.chimaera)).toBe(true);
  });

  it("no prompt when no other friendly unit has a When Defeated ability", async () => {
    const g = new GameTestAdapter();
    // Battlefield Marine has no When Defeated ability.
    const s = playSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.chimaera)).toBe(true);
  });
});

describe("JTL_039 Chimaera + JTL_002 Grand Admiral Thrawn", () => {
  // Thrawn triggers on *using* a When Defeated ability — which is exactly what Chimaera does.
  // Chimaera uses The Legacy Run's "Deal 6 damage divided among enemy units" without defeating
  // it, then Thrawn exhausts to use that same ability again: 12 damage total, Legacy Run alive.
  it("uses The Legacy Run's ability twice for 12 damage, without defeating it", async () => {
    const g = new GameTestAdapter();
    let b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.jtl.chimaera)
      .WithSpaceUnitForPlayer(1, Cards.units.lof.theLegacyRun);
    // 12 Clone Troopers (2/2) — one point of damage each, so none of them die and the
    // eligible-target list stays the same across both activations.
    for (let i = 0; i < 12; i++) b = b.WithGroundUnitForPlayer(2, Cards.units.token.cloneTrooper);
    g.loadNewState(b.Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Chimaera: use a When Defeated ability
    await g.chooseSpaceUnitAsync(1, 0); // The Legacy Run

    // First activation — 1 damage to each of the first 6 Troopers.
    await g.spreadDamageAsync(
      1,
      Array.from({ length: 6 }, (_, i) => [2, "Ground", i, 1] as [number, string, number, number]),
    );

    // Thrawn: exhaust to use that ability again.
    await g.chooseYesAsync(1);
    await g.spreadDamageAsync(
      1,
      Array.from({ length: 6 }, (_, i) => [2, "Ground", i + 6, 1] as [number, string, number, number]),
    );

    // 12 damage landed: every Trooper took exactly 1.
    const troopers = g.state.player2.groundArena;
    expect(troopers).toHaveLength(12);
    expect(troopers.every(u => u.damage === 1)).toBe(true);

    // The Legacy Run was never defeated — only its ability was used.
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.lof.theLegacyRun)).toBe(true);
    expect(g.state.player1.leader.ready).toBe(false); // Thrawn exhausted as the cost
  });
});

describe("JTL_039 Chimaera — When Defeated", () => {
  it("creates 2 TIE Fighter tokens", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Chimaera (5/6) already on 4 damage — trading with System Patrol Craft (3/4) defeats it.
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.chimaera, true, 4)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.chimaera)).toBe(false);
    expect(tieCount(g)).toBe(2);
  });
});
