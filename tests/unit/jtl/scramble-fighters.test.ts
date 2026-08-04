import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_092 Scramble Fighters (Event, Command/Villainy, cost 7) —
//   "Create 8 TIE Fighter tokens and ready them. They can't attack bases for this phase."
describe("JTL_092 Scramble Fighters", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithCardInHandForPlayer(1, Cards.events.jtl.scrambleFighters)
      .WithActivePlayer(1);
  }

  const ties = (g: GameTestAdapter) =>
    g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.tieFighter);

  it("creates exactly 8 TIE Fighter tokens in the space arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(ties(g)).toHaveLength(8);
  });

  it("they arrive READY — tokens are otherwise created exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(ties(g).every(t => t.ready)).toBe(true);
  });

  it("they can attack an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build()); // 4/10

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {}); // P1 cannot act twice in a row
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("they can NOT attack the enemy base this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithSpaceUnitAsync(1, 0);
    const res = await g.chooseBaseAsync(1, 2);

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the restriction is per-token — a pre-existing unit can still hit the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    // The pre-existing fighter is not one of the 8 and carries no restriction.
    const preExisting = g.state.player1.spaceArena.findIndex(u => u.cardId === Cards.units.sor.tieLnFighter);
    await g.attackWithSpaceUnitAsync(1, preExisting);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBeGreaterThan(0);
  });

  it("control: the restriction is Phase-scoped, not permanent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    const effects = g.state.currentEffects.filter(e => e.cardId === "JTL_092_no_base");

    expect(effects).toHaveLength(8);
    expect(effects.every(e => e.duration === "Phase")).toBe(true);
  });
});
