import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

// TWI_224 Breaking In (Event, cost 2) — "Attack with a unit. It gets +2/+0 and gains Saboteur
// for this attack. (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)"

describe("TWI_224 Breaking In", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.twi.breakingIn);
  }

  it("the attacking unit gets +2/+0 for this attack", async () => {
    // Battlefield Marine is 3/3 — with +2/+0 it deals 5 to the enemy base.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("Saboteur lets the attack ignore Sentinel — a non-Sentinel unit is a legal direct target", async () => {
    // Homestead Militia gains Sentinel while its controller has 6+ resources.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.events.twi.breakingIn)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.homesteadMilitia) // Sentinel
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // non-Sentinel
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as NeedsTarget;
    // Saboteur ignores the Sentinel restriction — the non-Sentinel Marine is offered directly.
    expect(res.fromPlayIds).toContain(marinePlayId);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // Attack resolved against the non-Sentinel unit directly (5 damage defeats the 3-HP Marine).
    expect(g.state.player2.groundArena.find(u => u.playId === marinePlayId)).toBeUndefined();
  });

  it("Saboteur defeats the defender's Shield before damage is dealt", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.twi.breakingIn)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt) // 9 HP — survives the hit
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;
    state.player2.groundArena[0].upgrades.push({ cardId: "SOR_T02", playId: "shield1", owner: 2, controller: 2 });

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId)!;
    // Shield was stripped by Saboteur (not by normal shield-absorption), so full combat
    // damage (3 base power + 2 from Breaking In = 5) landed directly.
    expect(defender.upgrades.some(u => u.cardId === "SOR_T02")).toBe(false);
    expect(defender.damage).toBe(5);
  });
});
