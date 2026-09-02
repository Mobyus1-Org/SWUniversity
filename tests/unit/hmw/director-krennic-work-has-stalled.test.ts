import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_061 Director Krennic — The Work Has Stalled (3/4 Ground, cost 3, Vigilance/Villainy,
// Imperial/Official, unique) —
//   "On Attack: If your base is upgraded, draw a card."
//
// The first card to READ the Fortify mechanic rather than create it: "your base is upgraded" means
// base.upgrades is non-empty. Any Fortify upgrade counts — the text names no card.
//
// It is a condition, not a cost, so an un-upgraded base simply draws nothing; the attack is
// unaffected either way.

const KRENNIC = "HMW_061";
const FORTIFY_UPGRADE = "HMW_081";      // Alliance Shield Generator
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(opts: { myBaseUpgraded?: boolean; theirBaseUpgraded?: boolean } = {}) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)   // Vigilance
    .MyLeader(Cards.leaders.sor.directorKrennic) // SOR_001 — Vigilance/Villainy, matches Krennic
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, KRENNIC)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(1);
  if (opts.myBaseUpgraded) {
    b = b.WithUpgradesOnBaseForPlayer(1, [{ cardId: FORTIFY_UPGRADE, playId: "@", owner: 1, controller: 1 }]);
  }
  if (opts.theirBaseUpgraded) {
    b = b.WithUpgradesOnBaseForPlayer(2, [{ cardId: FORTIFY_UPGRADE, playId: "@2", owner: 2, controller: 2 }]);
  }
  return b;
}

async function krennicAttacks(g: GameTestAdapter) {
  const idx = g.state.player1.groundArena.findIndex(u => u.cardId === KRENNIC);
  await g.attackWithGroundUnitAsync(1, idx);
  await g.chooseBaseAsync(1, 2);
}

describe("HMW_061 Director Krennic — The Work Has Stalled", () => {
  it("draws a card on attack while your base is upgraded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ myBaseUpgraded: true }).Build());
    const before = g.state.player1.hand.length;

    await krennicAttacks(g);

    expect(g.state.player1.hand.length).toBe(before + 1);
    expect(g.state.player2.base.damage).toBe(3); // the attack still landed
  });

  it("draws nothing while your base is bare", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const before = g.state.player1.hand.length;

    await krennicAttacks(g);

    expect(g.state.player1.hand.length).toBe(before);
    expect(g.state.player2.base.damage).toBe(3); // unmet condition never blocks the attack
  });

  it("the OPPONENT's upgraded base does not count — 'your base'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ theirBaseUpgraded: true }).Build());
    const before = g.state.player1.hand.length;

    await krennicAttacks(g);

    expect(g.state.player1.hand.length).toBe(before);
  });

  it("draws only ONE card even with several Fortify upgrades", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnBaseForPlayer(1, [
          { cardId: FORTIFY_UPGRADE, playId: "@a", owner: 1, controller: 1 },
          { cardId: "HMW_171", playId: "@b", owner: 1, controller: 1 },
        ])
        .Build(),
    );
    const before = g.state.player1.hand.length;

    await krennicAttacks(g);

    expect(g.state.player1.hand.length).toBe(before + 1);
  });

  it("draws nothing once Krennic loses his abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ myBaseUpgraded: true }).Build());
    const krennic = g.state.player1.groundArena.find(u => u.cardId === KRENNIC)!;
    g.state.currentEffects.push({
      cardId: "SOR_138", // Force Lightning
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: krennic.playId,
    });
    const before = g.state.player1.hand.length;

    await krennicAttacks(g);

    expect(g.state.player1.hand.length).toBe(before);
  });

  it("another unit attacking does not draw — the ability is Krennic's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ myBaseUpgraded: true }).WithGroundUnitForPlayer(1, MARINE).Build());
    const before = g.state.player1.hand.length;

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand.length).toBe(before);
  });
});
