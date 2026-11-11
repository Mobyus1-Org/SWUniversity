import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_101 Queen Amidala — Championing Her People (5/3 Ground, cost 5, Naboo/Official)
//   "When Played: Create 2 Spy tokens.
//    If damage would be dealt to this unit, you may defeat another friendly unit that shares a
//    trait with this unit. If you do, prevent that damage."
// Spy tokens are Officials, so her own Spies are legal sacrifices. Ability damage is held back
// while she is asked; combat damage is offered before the attack (as for ASH_062).

const AMIDALA = Cards.units.sec.queenAmidala;
const SPY = Cards.units.token.spy;                            // 0/2 Ground, Official
const GIDEON = Cards.units.ash.moffGideonRemnantCommander;    // 2/5 Ground Official, Sentinel; WD return
const MARINE = Cards.units.sor.battlefieldMarine;             // 3/3 Ground Rebel/Trooper — shares nothing
const DEATH_TROOPER = Cards.units.sor.deathTrooper;           // non-unique Imperial
const WAMPA = Cards.units.sor.wampa;                          // 4/5 Ground
const OPEN_FIRE = Cards.events.sor.openFire;                  // Deal 4 damage to a unit

type Res = { type?: string; fromPlayIds?: string[]; player?: number } | undefined;
const resolution = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;
const amidala = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === AMIDALA);

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14);
}

/** P2 Open-Fires P1's Amidala (4 damage — lethal on her 3 HP). */
async function openFireOnAmidala(g: GameTestAdapter) {
  await g.playCardFromHandAsync(2, 0);
  await g.dispatchAsync(2, "choose-target", { targetPlayIds: [amidala(g)!.playId] });
}

describe("SEC_101 Queen Amidala — When Played", () => {
  it("creates 2 Spy tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithActivePlayer(1).WithCardInHandForPlayer(1, AMIDALA).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId).sort()).toEqual([AMIDALA, SPY, SPY].sort());
  });
});

describe("SEC_101 Queen Amidala — prevention against ability damage", () => {
  function setup() {
    return board()
      .WithActivePlayer(2)
      .WithCardInHandForPlayer(2, OPEN_FIRE)
      .WithGroundUnitForPlayer(1, AMIDALA)
      .WithGroundUnitForPlayer(1, SPY)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, SPY); // an ENEMY Official — never a legal sacrifice
  }

  it("offers only another friendly unit that shares a trait, then prevents the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await openFireOnAmidala(g);
    expect(resolution(g)?.type).toBe("Option");
    expect(amidala(g)!.damage).toBe(0); // held back while P1 decides
    await g.chooseYesAsync(1);

    const spy = g.state.player1.groundArena.find(u => u.cardId === SPY)!;
    expect(resolution(g)?.fromPlayIds).toEqual([spy.playId]); // not Amidala, the Marine, or P2's Spy
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spy.playId] });

    expect(amidala(g)!.damage).toBe(0);
    expect(g.state.player1.groundArena.map(u => u.cardId).sort()).toEqual([AMIDALA, MARINE].sort());
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("declining lets the damage through — she is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await openFireOnAmidala(g);
    await g.chooseNoAsync(1);

    expect(amidala(g)).toBeUndefined();
    expect(g.state.player1.groundArena.filter(u => u.cardId === SPY)).toHaveLength(1);
  });

  it("no offer when no other friendly unit shares a trait", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await openFireOnAmidala(g);

    expect(resolution(g)).toBeFalsy();
    expect(amidala(g)).toBeUndefined();
  });

  it("the sacrificed unit's When Defeated still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, GIDEON)
        .WithCardInDiscardForPlayer(1, DEATH_TROOPER)
        .Build(),
    );

    await openFireOnAmidala(g);
    await g.chooseYesAsync(1);
    const gideon = g.state.player1.groundArena.find(u => u.cardId === GIDEON)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [gideon.playId] });

    expect(amidala(g)!.damage).toBe(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(GIDEON);
    // Moff Gideon's When Defeated: may return a non-unique Imperial unit from the discard pile.
    expect(resolution(g)).toBeTruthy();
  });
});

describe("SEC_101 Queen Amidala — alongside ASH_062 The Mandalorian", () => {
  // Both can cover her: Mando ("another friendly unit") is asked first; declining him moves on to
  // her own prevention rather than letting the damage through.
  it("declining the Mandalorian's offer still offers hers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, SPY)
        .WithGroundUnitForPlayer(1, Cards.units.ash.theMandalorianDevotedRescuer)
        .WithUpgradesOnGroundUnitForPlayer(1, 2, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1)])
        .Build(),
    );

    await openFireOnAmidala(g);
    expect((g.lastDispatchResponse?.resolutionNeeded as { helperText?: string })?.helperText).toMatch(/Shield/);
    await g.chooseNoAsync(1);
    expect(resolution(g)?.type).toBe("Option"); // now hers
    await g.chooseYesAsync(1);
    const spy = g.state.player1.groundArena.find(u => u.cardId === SPY)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spy.playId] });

    expect(amidala(g)!.damage).toBe(0);
    const mando = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.theMandalorianDevotedRescuer)!;
    expect(mando.upgrades).toHaveLength(1); // his Shield was not spent
  });
});

describe("SEC_101 Queen Amidala — prevention against combat damage", () => {
  it("attacking: prevents the counter-damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(1)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, SPY)
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(resolution(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const spy = g.state.player1.groundArena.find(u => u.cardId === SPY)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spy.playId] });

    expect(amidala(g)!.damage).toBe(0);
    expect(g.state.player2.groundArena).toHaveLength(0); // the Wampa took her 5
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([AMIDALA]);
  });

  it("defending: her controller is asked, and the damage is prevented", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, SPY)
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(resolution(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const spy = g.state.player1.groundArena.find(u => u.cardId === SPY)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spy.playId] });

    expect(amidala(g)!.damage).toBe(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("attacking: declining, she trades with the defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(1)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, SPY)
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(amidala(g)).toBeUndefined();
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SPY]);
  });

  it("attacking a base: no damage would be dealt to her, so no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithActivePlayer(1)
        .WithGroundUnitForPlayer(1, AMIDALA)
        .WithGroundUnitForPlayer(1, SPY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(resolution(g)).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.groundArena).toHaveLength(2);
  });
});
