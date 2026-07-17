import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_157 Danger Squadron Wingmen (Space, cost 4) —
// "On Attack: You may give an Advantage token to another unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("ASH_157 Danger Squadron Wingmen — On Attack", () => {
  it("may give an Advantage token to another unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.dangerSquadronWingmen)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });

  it("cannot target itself", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.dangerSquadronWingmen)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const wingmenPlayId = state.player1.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wingmenPlayId] });

    expect(resp.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.dangerSquadronWingmen)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    const marine = g.state.player1.groundArena[0];
    expect(marine.upgrades).toHaveLength(0);
  });
});
