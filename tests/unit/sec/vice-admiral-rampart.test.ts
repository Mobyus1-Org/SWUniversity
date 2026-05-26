import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_085 Vice Admiral Rampart — On Attack: You may disclose CommandCommandVillainy.
// If you do, give an Experience token to each of up to 2 other units.
// Aspects: Command+Villainy (covered by Moff Gideon leader).
// Two ISB Shuttles (SEC_083, each Command+Villainy) in hand cover the Command×2+Villainy disclose.

describe("SEC_085 Vice Admiral Rampart", () => {
  it("offers disclose option when hand has enough aspects", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sec.viceAdmiralRampart)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // need at least one other unit
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Option");
    if (resolution?.type === "Option") {
      expect(resolution.options).toContain("Yes");
      expect(resolution.options).toContain("No");
    }
  });

  it("gives Experience to chosen units after disclosing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sec.viceAdmiralRampart)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)
        .Build(),
    );

    const enemy0 = g.state.player2.groundArena[0].playId;
    const enemy1 = g.state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy0] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy0, enemy1] });

    expect(g.state.player2.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    expect(g.state.player2.groundArena[1].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("skips ability when hand cannot disclose", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sec.viceAdmiralRampart)
        // No cards in hand — cannot disclose
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Attack should resolve immediately (no ability-option prompt)
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(3); // Rampart has 3 power
  });
});
