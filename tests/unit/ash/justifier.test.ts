import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_146 Justifier (Space, cost 5) — "When Played/On Attack: You may deal 1 damage to a unit.
// If that unit is defeated this way, give an Advantage token to a unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_146 Justifier — When Played", () => {
  it("deals 1 damage and, if defeated, gives an Advantage token to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.justifier)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1 HP — dies to 1 damage
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Advantage token recipient
      .Build();
    g.loadNewState(state);

    const droidPlayId = state.player2.groundArena[0].playId;
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [droidPlayId] });

    expect(g.state.player2.groundArena.some(u => u.playId === droidPlayId)).toBe(false); // defeated

    // Follow-up: give an Advantage token to a unit.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });

  it("does not offer the Advantage follow-up when the target survives (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.justifier)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 2 HP — survives 1 damage
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(resp.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const marine = g.state.player2.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.damage).toBe(1);
    expect(marine.upgrades).toHaveLength(0);
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.justifier)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});

describe("ASH_146 Justifier — On Attack", () => {
  it("also fires when Justifier attacks", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.justifier)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // damage target
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Advantage recipient
      .Build();
    g.loadNewState(state);

    const droidPlayId = state.player2.groundArena[0].playId;
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [droidPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });
});
