import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_108 Vanguard Infantry", () => {
  it("When Defeated: prompts to give an Experience token, chosen unit receives it", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)  // 1/2
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — kills Vanguard on counter
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    // Vanguard attacks Marine; Marine counter-deals 3 (>2 HP) → Vanguard dies
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // WD fires: "Give an Experience token to a unit?"
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    // Choose target for the Experience token
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("When Defeated: player may decline — no Experience token given", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    await g.chooseNoAsync(1); // Decline WD

    expect(g.state.player2.groundArena[0].upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(0);
  });

  it("When Defeated via Exploit: WD fires after card fully resolves", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)  // Exploit 1
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // Admiral Trench (Exploit 1 prompt)
    await g.chooseYesAsync(1);           // Accept Exploit
    await g.exploitGroundUnitsAsync(1, [0]); // Exploit Vanguard Infantry

    // Trench enters play; his WP fires first: return up to 3 defeated units from discard
    // Vanguard is now in discard — skip returning any units
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    // Now Vanguard's WD fires
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    // Give XP to Trench
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.admiralTrench)).toBe(true);
    const trenchPlayId = g.state.player1.groundArena.find(u => u.cardId === Cards.units.twi.admiralTrench)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trenchPlayId] });

    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.twi.admiralTrench)?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });
});
