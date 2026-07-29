import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// LAW_132 The Tree Remembers — cost 4 Vigilance event.
// "An enemy unit loses all abilities for this phase. If it costs 3 or less, defeat it."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.events.law.theTreeRemembers);
}

describe("LAW_132 The Tree Remembers", () => {
  it("strips a 4-cost enemy unit's abilities without defeating it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft).Build()); // cost 4, Sentinel

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const u = g.state.player2.spaceArena[0];
    expect(u).toBeDefined(); // costs more than 3 — survives
    expect(HasSentinel(u.cardId, u.playId, 2)).toBe(false); // its Sentinel is gone
  });

  it("defeats an enemy unit that costs 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build()); // cost 2

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("defeats regardless of remaining HP — the cost is what matters", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(2, Cards.units.ash.marrok).Build(), // cost 3, 2/6 — undamaged
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does not defeat a 5-cost unit, but does strip its abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards).Build()); // cost 5

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const u = g.state.player2.groundArena[0];
    expect(u).toBeDefined();
    expect(HasSentinel(u.cardId, u.playId, 2)).toBe(false);
  });

  it("cannot target a friendly unit ('an ENEMY unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const friendlyPlayId = g.state.player1.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("does not prompt when the opponent controls no unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("the ability loss is scoped to this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const playId = g.state.player2.spaceArena[0].playId;
    const effects = g.state.currentEffects.filter(
      e => e.cardId === Cards.events.law.theTreeRemembers && e.targetPlayId === playId,
    );
    expect(effects).toHaveLength(1);
    expect(effects[0].duration).toBe("Phase");
  });

  it("defeats a 2-cost ship piloted by Chewbacca (JTL_103): it loses the protection first", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing) // cost 2
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // "Can't be defeated by enemy card abilities" is an ability, so it is stripped along with the
    // rest — and the 2-cost ship is then defeated by this same event.
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(Cards.units.jtl.phoenixSquadronAWing);
  });

  it("control: without the ability loss, that same ship can't be defeated by an enemy ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // Vanquish — "Defeat a non-leader unit."

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // no legal target
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("strips Chewbacca's own protection, letting a later card defeat him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .WithGroundUnitForPlayer(2, Cards.units.jtl.chewbacca) // cost 5 — survives The Tree Remembers
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // The Tree Remembers
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena).toHaveLength(1); // cost 5, not defeated

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Rival's Fall — "Defeat a unit."
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
