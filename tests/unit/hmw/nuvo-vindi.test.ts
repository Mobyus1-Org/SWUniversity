import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_062 Nuvo Vindi — Blue Shadow Perfected (Unit, cost 3, 1/4 Ground, Vigilance/Villainy)
//   "When Played: You may give a Weakness token to a unit."
//   "When an enemy unit with a Weakness token on it is defeated: You may give a Weakness token
//    to a unit. Use this ability only once each round."
const NUVO = Cards.units.hmw.nuvoVindi;
// The Weakness token is filed under units.token with the other HMW tokens, not upgrades.token.
const WEAKNESS = Cards.units.token.weakness;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 — 2/2 under a Weakness token
const BRUISER = Cards.units.ash.deathTrooperSquad;     // 5/4 attacker

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP) // Vigilance
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const offered = (g: GameTestAdapter) => {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const weaknessCount = (g: GameTestAdapter, p: 1 | 2) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena
    .reduce((n, u) => n + u.upgrades.filter(up => up.cardId === WEAKNESS).length, 0);

describe("HMW_062 Nuvo Vindi — When Played", () => {
  it("may give a Weakness token to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, NUVO).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(weaknessCount(g, 2)).toBe(1);
  });

  it("may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, NUVO).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option"); // the offer really opened
    await g.chooseNoAsync(1);

    expect(weaknessCount(g, 2)).toBe(0);
  });

  it("reaches either player's units — the text says 'a unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(1, NUVO)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    // Both Marines plus Nuvo himself, who is now in play.
    expect(offered(g)?.length).toBe(3);
  });
});

describe("HMW_062 Nuvo Vindi — the defeat reaction", () => {
  /** Nuvo in play for P1; P2 has a Weakness-tokened Marine and P1 a bruiser to kill it with. */
  function reactionSetup(weaknessOnEnemy = true, friendlyWeakness = false) {
    let b = setup()
      .WithGroundUnitForPlayer(1, NUVO)
      .WithGroundUnitForPlayer(1, BRUISER)
      .WithGroundUnitForPlayer(2, MARINE);
    if (weaknessOnEnemy) {
      b = b.WithUpgradesOnGroundUnitForPlayer(2, 0, [
        { cardId: WEAKNESS, playId: "w-enemy", owner: 1, controller: 1 },
      ]);
    }
    if (friendlyWeakness) {
      b = b.WithUpgradesOnGroundUnitForPlayer(1, 1, [
        { cardId: WEAKNESS, playId: "w-friendly", owner: 2, controller: 2 },
      ]);
    }
    return b;
  }

  /** P1's bruiser (ground index 1) kills P2's Marine (ground index 0). */
  async function killEnemyMarine(g: GameTestAdapter) {
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseGroundUnitAsync(2, 0);
  }

  /**
   * Two ready bruisers for P1 and two Weakness-tokened Marines for P2, so the reaction can be
   * offered twice in one round. A single attacker cannot do it — it exhausts on its first swing,
   * and the second attack silently never happens.
   */
  function twoKillsSetup() {
    return setup()
      .WithGroundUnitForPlayer(1, NUVO)
      .WithGroundUnitForPlayer(1, BRUISER)
      .WithGroundUnitForPlayer(1, BRUISER)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        { cardId: WEAKNESS, playId: "w-e1", owner: 1, controller: 1 },
      ])
      .WithUpgradesOnGroundUnitForPlayer(2, 1, [
        { cardId: WEAKNESS, playId: "w-e2", owner: 1, controller: 1 },
      ]);
  }

  /** Attacks with the Nth still-ready bruiser into the first enemy Marine, by playId. */
  async function killWithBruiser(g: GameTestAdapter, which: 0 | 1) {
    const bruisers = g.state.player1.groundArena.filter(u => u.cardId === BRUISER && u.ready);
    const victim = g.state.player2.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: bruisers[which].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim.playId] });
  }

  it("fires when an enemy unit with a Weakness token is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(reactionSetup().Build());

    await killEnemyMarine(g);
    expect(needs(g)?.type).toBe("Option"); // the reaction offered
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // put the token on Nuvo himself — any unit is legal

    expect(weaknessCount(g, 1)).toBe(1);
  });

  it("does NOT fire when the defeated enemy had no Weakness token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(reactionSetup(false).Build());

    await killEnemyMarine(g);

    expect(needs(g)).toBeUndefined();
    expect(weaknessCount(g, 1)).toBe(0);
  });

  it("does NOT fire for a FRIENDLY unit with a Weakness token — it must be an enemy", async () => {
    const g = new GameTestAdapter();
    // P1's own bruiser carries the Weakness token and dies attacking into a big enemy.
    const s = setup()
      .WithGroundUnitForPlayer(1, NUVO)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [
        { cardId: WEAKNESS, playId: "w-friendly", owner: 2, controller: 2 },
      ])
      .WithGroundUnitForPlayer(2, BRUISER) // 5/4 kills a 2/2 Marine and survives
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 1); // the tokened Marine attacks and dies
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false); // it died
    expect(needs(g)).toBeUndefined(); // but Nuvo stayed quiet
  });

  it("only once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoKillsSetup().Build());

    await killWithBruiser(g, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // the token goes on Nuvo
    expect(weaknessCount(g, 1)).toBe(1);

    // A second qualifying defeat this round offers nothing.
    await g.dispatchAsync(2, "pass-action", {});
    await killWithBruiser(g, 0); // the other bruiser — the first one is exhausted
    expect(g.state.player2.groundArena).toHaveLength(0); // the second Marine really did die

    expect(needs(g)).toBeUndefined();
    expect(weaknessCount(g, 1)).toBe(1); // still just the one
  });

  it("declining does not spend the once-each-round use", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoKillsSetup().Build());

    await killWithBruiser(g, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1); // decline — the ability was not used

    await g.dispatchAsync(2, "pass-action", {});
    await killWithBruiser(g, 0);

    // Still available, so the second defeat offers it again.
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    expect(weaknessCount(g, 1)).toBe(1);
  });

  it("does not fire with Nuvo off the board", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithGroundUnitForPlayer(1, BRUISER)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        { cardId: WEAKNESS, playId: "w-enemy", owner: 1, controller: 1 },
      ])
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(needs(g)).toBeUndefined();
  });
});
