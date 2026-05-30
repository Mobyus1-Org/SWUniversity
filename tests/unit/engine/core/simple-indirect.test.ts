import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Simple Indirect Damage Test", () => {
  it("should assign indirect damage all to the base", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(2)
      .WithInitiativePlayerBeing(2)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(2, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(2, 0);

    // Choose to target the opponent (player 1)
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.dispatchAsync(2, "choose-option", { option: "Opponent" });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: 'player1.base', damage: 5 }],
    });

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("should assign indirect damage to the base and to units", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(2)
      .WithInitiativePlayerBeing(2)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(2, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.brightHope)
      .Build();
    g.loadNewState(s);

    const marinePlayId = s.player1.groundArena[0].playId;
    const brightHopePlayId = s.player1.spaceArena[0].playId;

    await g.playCardFromHandAsync(2, 0);

    // Choose to target the opponent (player 1)
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.dispatchAsync(2, "choose-option", { option: "Opponent" });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: 'player1.base', damage: 2 },
        { playId: marinePlayId, damage: 1 },
        { playId: brightHopePlayId, damage: 2 },
      ],
    });

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(g.state.player1.spaceArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("should assign indirect damage to a shielded unit without defeating the shield", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(2)
      .WithInitiativePlayerBeing(2)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(2, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
      ])
      .Build();
    g.loadNewState(s);

    const marinePlayId = s.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(2, 0);

    // Choose to target the opponent (player 1)
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.dispatchAsync(2, "choose-option", { option: "Opponent" });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: 'player1.base', damage: 4 },
        { playId: marinePlayId, damage: 1 },
      ],
    });

    expect(g.state.player1.base.damage).toBe(4);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(1); // shield intact
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("should assign indirect damage to a double shielded unit without defeating any shields", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(2)
      .WithInitiativePlayerBeing(2)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(2, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
      ])
      .Build();
    g.loadNewState(s);

    const marinePlayId = s.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(2, 0);

    // Choose to target the opponent (player 1)
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.dispatchAsync(2, "choose-option", { option: "Opponent" });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: 'player1.base', damage: 3 },
        { playId: marinePlayId, damage: 2 },
      ],
    });

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(2); // both shields intact
    expect(g.state.player2.base.damage).toBe(0);
  });
});
