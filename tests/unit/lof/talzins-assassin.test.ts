import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

/** Passes both players' actions, then both regroup-resource steps, landing in the next action phase. */
async function advanceToNextActionPhase(g: GameTestAdapter) {
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-resource", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-resource", {});
}

// LOF_035 Talzin's Assassin (4/4 Ground, cost 4, Vigilance/Villainy, Force/Night) —
//   "When Played: You may use the Force (lose your Force token).
//    If you do, give a unit –3/–3 for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.lof.talzinsAssassin);
}

describe("LOF_035 Talzin's Assassin", () => {
  it("uses the Force to give a chosen unit –3/–3 for this phase", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.forceToken).toBe(false); // the Force was spent
    const target = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(target.CurrentPower()).toBe(0); // 3 - 3
    expect(target.TotalHP()).toBe(4); // 7 - 3
  });

  it("can target a friendly unit — 'a unit', not 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const target = Unit.FromInterface(
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!,
    );
    expect(target.CurrentPower()).toBe(0);
    expect(target.TotalHP()).toBe(4);
  });

  it("declining keeps the Force token and applies no debuff", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    // The prompt must actually exist — otherwise this passes for the wrong reason.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseNoAsync(1);

    expect(g.state.player1.supplemental.forceToken).toBe(true); // kept
    const target = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(target.CurrentPower()).toBe(3);
    expect(target.TotalHP()).toBe(7);
  });

  it("does not prompt at all with no Force token", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = false;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const target = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(target.CurrentPower()).toBe(3);
  });

  it("defeats a damaged unit whose reduced HP no longer exceeds its damage", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1) // 3/3 with 1 damage
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // HP 3 → 0, which is at or below its 1 damage — defeated on the spot.
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("the debuff wears off at end of phase", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(0);

    await advanceToNextActionPhase(g);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(3);
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).TotalHP()).toBe(7);
  });
});
