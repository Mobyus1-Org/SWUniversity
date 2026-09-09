import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// TWI_069 Roger Roger. Cost 1 Vigilance Learned upgrade, +1/+1.
//   "When Defeated: Attach this upgrade to a friendly Battle Droid token."
//
// Its host dying is what defeats it, so the re-attach happens as the host leaves play. With no
// other Battle Droid token to receive it, it goes to the discard like any other upgrade.

const ROGER = Cards.upgrades.twi.rogerRoger;
const DROID = Cards.units.token.battleDroid; // 1/1
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

/** Player 2's Marine attacks and kills player 1's ground unit at index 0. */
async function killFirstP1Unit(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(2, 0);
  await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
}

describe("TWI_069 Roger Roger", () => {
  it("re-attaches to another friendly Battle Droid token when its host dies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, DROID)  // the host, index 0
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(ROGER, 1)])
        .WithGroundUnitForPlayer(1, DROID)  // the receiver
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await killFirstP1Unit(g);

    const survivor = g.state.player1.groundArena.find(u => u.cardId === DROID)!;
    expect(survivor.upgrades.filter(u => u.cardId === ROGER)).toHaveLength(1);
    expect(g.state.player1.discard.some(c => c.cardId === ROGER)).toBe(false);
    // 1/1 token plus Roger Roger's +1/+1.
    const buffed = Unit.FromInterface(survivor);
    expect(buffed.CurrentPower()).toBe(2);
    expect(buffed.TotalHP()).toBe(2);
  });

  it("goes to the discard when there is no other Battle Droid token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, DROID)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(ROGER, 1)])
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await killFirstP1Unit(g);

    expect(g.state.player1.discard.some(c => c.cardId === ROGER)).toBe(true);
    // The host is a TOKEN, so it ceases to exist rather than being discarded.
    expect(g.state.player1.discard.some(c => c.cardId === DROID)).toBe(false);
  });

  it("does not move to an ENEMY Battle Droid token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, DROID)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(ROGER, 1)])
        .WithGroundUnitForPlayer(2, MARINE) // index 0 — the attacker
        .WithGroundUnitForPlayer(2, DROID)
        .Build(),
    );

    await killFirstP1Unit(g);

    expect(g.state.player2.groundArena.every(u => !u.upgrades.some(x => x.cardId === ROGER))).toBe(true);
    expect(g.state.player1.discard.some(c => c.cardId === ROGER)).toBe(true);
  });
});
