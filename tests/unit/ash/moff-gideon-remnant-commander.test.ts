import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// ASH_097 Moff Gideon (Remnant Commander) (2/5 Ground) —
// "Sentinel" + "When Defeated: You may return a non-unique Imperial unit from your discard to your hand."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_097 Moff Gideon (Remnant Commander)", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.moffGideonRemnantCommander).Build());
    const gideon = g.state.player1.groundArena[0];
    expect(HasKeyword(Cards.units.ash.moffGideonRemnantCommander, "Sentinel", gideon.playId, 1)).toBe(true);
  });

  it("When Defeated: returns a chosen non-unique Imperial unit from discard to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.moffGideonRemnantCommander)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4 power kills the 2/5? no — 5 HP
        .WithCardInDiscardForPlayer(1, Cards.units.sor.seasonedShoretrooper) // a non-unique Imperial unit
        .Build(),
    );
    // Make Gideon lethal to the counter-attack: pre-damage him to 1 HP.
    g.state.player1.groundArena[0].damage = 4;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0); // Gideon (5 damage on a 5-HP after? he has 4 dmg, 1 HP) attacks
    await g.chooseGroundUnitAsync(2, 0);     // 4-power Honor Guards counter kills Gideon
    await g.chooseYesAsync(1);               // use When Defeated
    const shoretrooperPlayId = g.state.player1.discard.find(c => c.cardId === Cards.units.sor.seasonedShoretrooper)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shoretrooperPlayId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.moffGideonRemnantCommander)).toBe(false);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.seasonedShoretrooper)).toBe(true);
    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });

  it("no prompt when the discard has no non-unique Imperial unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.moffGideonRemnantCommander)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );
    g.state.player1.groundArena[0].damage = 4;

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
