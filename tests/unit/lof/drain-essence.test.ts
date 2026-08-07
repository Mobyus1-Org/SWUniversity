import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_041 Drain Essence (Event, cost 2, Vigilance/Villainy, Force) —
//   "Deal 2 damage to a unit. The Force is with you (create your Force token)."
//
// Both clauses are mandatory and unconditional. Unlike Cure Wounds / Sorcerous Blast this CREATES
// the token rather than spending it, so there is no "if you do" gate on either half.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.lof.drainEssence);
}

describe("LOF_041 Drain Essence", () => {
  it("deals 2 damage to the chosen unit and creates the Force token", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
      .Build();
    s.player1.supplemental.forceToken = false;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("can target a friendly unit — 'a unit', not 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("defeats a unit the 2 damage is lethal to", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sec.sithAssassin) // 3/2 — dies to 2
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("still creates the Force token with no units in play to damage", async () => {
    // The damage clause has nothing to do, but "The Force is with you" is a separate sentence and
    // is not conditional on it — this is the clause that would silently go missing.
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    s.player1.supplemental.forceToken = false;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("leaves the player with exactly one token when they already had one", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("gives the token to its caster, not the opponent", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = false;
    s.player2.supplemental.forceToken = false;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
    expect(g.state.player2.supplemental.forceToken).toBe(false);
  });

  it("control: an event that does not create a token leaves the player without one", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid) // 2 damage, no Force clause
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = false;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });
});
