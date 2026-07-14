import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// ASH_040 Poe Dameron (3/3 Ground, cost 2) — "All units lose Sentinel."
// A constant ability: it strips Sentinel from EVERY unit, friendly and enemy alike.

function setup(withPoe: boolean) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
    // Academy Defense Walker (SOR_037) has Sentinel.
    .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
  if (withPoe) b = b.WithGroundUnitForPlayer(1, Cards.units.ash.poeDameron);
  return b.Build();
}

describe("ASH_040 Poe Dameron — All units lose Sentinel", () => {
  it("strips Sentinel from an enemy Sentinel unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true));

    const walker = g.state.player2.groundArena[0];
    expect(HasSentinel(walker.cardId, walker.playId, 2)).toBe(false);
  });

  it("that Sentinel unit still has Sentinel without Poe in play (control)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false));

    const walker = g.state.player2.groundArena[0];
    expect(HasSentinel(walker.cardId, walker.playId, 2)).toBe(true);
  });

  it("lets you attack past an enemy Sentinel — base and non-Sentinel units become targetable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true));

    // Without Poe this attack would be forced onto the Academy Defense Walker.
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // Battlefield Marine hit the base
  });

  it("strips Sentinel from FRIENDLY units too ('all units')", () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.ash.poeDameron)
      .WithGroundUnitForPlayer(1, Cards.units.sor.academyDefenseWalker)
      .Build();
    g.loadNewState(s);

    const ownWalker = g.state.player1.groundArena[1];
    expect(HasSentinel(ownWalker.cardId, ownWalker.playId, 1)).toBe(false);
  });

  it("an enemy-controlled Poe also strips Sentinel from your units", () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.academyDefenseWalker)
      .WithGroundUnitForPlayer(2, Cards.units.ash.poeDameron)
      .Build();
    g.loadNewState(s);

    const walker = g.state.player1.groundArena[0];
    expect(HasSentinel(walker.cardId, walker.playId, 1)).toBe(false);
  });
});
