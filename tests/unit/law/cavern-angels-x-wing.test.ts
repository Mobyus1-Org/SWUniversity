import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_189 Cavern Angels X-Wing (2/1 Space, cost 2, Aggression, Rebel/Vehicle/Fighter) —
//   "When Defeated: Deal 2 damage to a base."
// Mandatory, and "a base" — either base is a legal choice.
describe("LAW_189 Cavern Angels X-Wing", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren);
  }

  it("deals 2 damage to the chosen enemy base when defeated in combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.law.cavernAngelsXWing) // 2/1 — dies to counter-damage
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 — survives, kills it
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena.length).toBe(0); // the X-Wing died
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("can send the 2 damage to its controller's own base — 'a base'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.law.cavernAngelsXWing)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("fires when defeated by an ability rather than combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(2, Cards.events.shd.daringRaid) // deal 2 damage to a unit or base
        .WithSpaceUnitForPlayer(1, Cards.units.law.cavernAngelsXWing)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // the X-Wing's controller chooses the base

    expect(g.state.player1.spaceArena.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("control: a surviving X-Wing never prompts and deals no extra base damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.law.cavernAngelsXWing)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2); // attack the enemy base — nothing hits back

    expect(g.state.player1.spaceArena.length).toBe(1); // survived
    // Only the X-Wing's own 2 combat damage; the When Defeated never fired and never prompted.
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
