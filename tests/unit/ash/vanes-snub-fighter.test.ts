import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_144 Vane's Snub Fighter (Space, cost 3) — "When a friendly unit's attack ends: If it dealt
// combat damage to a base, give an Advantage token to this unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("ASH_144 Vane's Snub Fighter", () => {
  it("gains an Advantage token when it attacks a base itself (token survives its own end-of-attack cleanup)", async () => {
    const g = new GameTestAdapter();
    const state = base().WithSpaceUnitForPlayer(1, Cards.units.ash.vanesSnubFighter).Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const vane = g.state.player1.spaceArena[0];
    expect(vane.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });

  it("gains an Advantage token when a DIFFERENT friendly unit attacks a base", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.vanesSnubFighter)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 1); // the System Patrol Craft attacks
    await g.chooseBaseAsync(1, 2);

    const vane = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.vanesSnubFighter)!;
    expect(vane.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });

  it("does not gain a token when a friendly unit attacks a UNIT instead of a base (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.vanesSnubFighter)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 1);
    await g.chooseSpaceUnitAsync(2, 0);

    const vane = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.vanesSnubFighter)!;
    expect(vane.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(0);
  });

  it("does not gain a token from an ENEMY unit's attack on a base", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(2, Cards.units.ash.vanesSnubFighter)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const vane = g.state.player2.spaceArena.find(u => u.cardId === Cards.units.ash.vanesSnubFighter)!;
    expect(vane.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(0);
  });
});
