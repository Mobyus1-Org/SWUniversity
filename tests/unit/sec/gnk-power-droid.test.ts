import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_110 GNK Power Droid — 1/3 Ground, Command, Droid.
// "On Attack: The next unit you play this phase costs 1 resource less."
describe("SEC_110 GNK Power Droid — On Attack", () => {
  it("pushes a Phase SEC_110 effect onto the controller's currentEffects when it attacks", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sec.gnkPowerDroid)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    expect(g.state.currentEffects.some(
      e => e.cardId === "SEC_110" && e.affectedPlayer === 1,
    )).toBe(true);
  });
});

describe("SEC_110 GNK Power Droid — discount", () => {
  it("reduces the cost of the next unit by 1 and consumes the effect", async () => {
    // System Patrol Craft (SOR_066): Vigilance, cost 4, Space. Discount → 3.
    // Player has exactly 3 resources → can only play with the discount.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);
    state.currentEffects.push({ cardId: "SEC_110", duration: "Phase", affectedPlayer: 1 });

    await g.playCardFromHandAsync(1, 0);

    // SPC entered play (only possible with the -1 discount at 3 resources)...
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.systemPatrolCraft)).toBe(true);
    // ...and the discount was consumed.
    expect(g.state.currentEffects.some(e => e.cardId === "SEC_110")).toBe(false);
  });

  it("does NOT reduce the cost of an event and is not consumed by it", async () => {
    // Resupply (SOR_126): Command event, cost 3 — "Put this event into play as a resource."
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command leader → no aspect penalty on Command card
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.chewbacca)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.resupply)
      .Build();
    g.loadNewState(state);
    state.currentEffects.push({ cardId: "SEC_110", duration: "Phase", affectedPlayer: 1 });

    await g.playCardFromHandAsync(1, 0);

    // The unit discount survives an event play — it only applies to (and is consumed by) units.
    expect(g.state.currentEffects.some(e => e.cardId === "SEC_110" && e.affectedPlayer === 1)).toBe(true);
  });
});
