import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_247 One Must Destroy to Create (Event, cost 3)
// "Defeat a friendly non-leader unit. Then, you may play that unit from your discard pile for free."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_247 One Must Destroy to Create", () => {
  it("defeats a friendly unit and replays it from the discard for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.oneMustDestroyToCreate)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 5) // damaged
        .Build(),
    );

    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.playCardFromHandAsync(1, 0);
    const readyAfterEvent = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseGroundUnitAsync(1, 0);
    const inDiscard = g.state.player1.discard.find(d => d.cardId === Cards.units.sor.consularSecurityForce)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [inDiscard.playId] });

    // Back in play, fresh — the damage did not follow it.
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.sor.consularSecurityForce);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.discard.map(c => c.cardId)).not.toContain(Cards.units.sor.consularSecurityForce);
    // "for free" — replaying cost nothing beyond the event itself.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyAfterEvent);
    expect(readyAfterEvent).toBeLessThan(readyBefore);
  });

  it("may decline the replay — the unit stays in the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.oneMustDestroyToCreate)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
  });

  it("resolves the defeated unit's When Defeated ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.oneMustDestroyToCreate)
        // Mandalorian Scout — "When Defeated: Exhaust a ready friendly resource."
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout)
        .Build(),
    );

    const exhaustedBefore = g.state.player1.resources.filter(r => !r.ready).length;
    await g.playCardFromHandAsync(1, 0);
    const exhaustedAfterEvent = g.state.player1.resources.filter(r => !r.ready).length;
    await g.chooseGroundUnitAsync(1, 0);

    // One more resource exhausted than the event itself cost.
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(exhaustedAfterEvent + 1);
    expect(exhaustedAfterEvent).toBeGreaterThan(exhaustedBefore);
  });

  it("cannot target an ENEMY unit or a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, Cards.events.ash.oneMustDestroyToCreate)
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano)          // friendly leader unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // the only legal target
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId,
    ]);
  });

  it("does nothing when the caster controls no non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.oneMustDestroyToCreate)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
