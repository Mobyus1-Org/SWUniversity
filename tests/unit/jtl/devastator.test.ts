import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { NeedsSpreadDamage } from "@/lib/engine/message-types";

// JTL_143 Devastator — Hunting the Rebellion (9/6 Space, Imperial/Vehicle/Capital Ship, cost 8)
// "You assign all indirect damage you deal to opponents."
// "When Played: Deal 4 indirect damage to each opponent."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20);
}

describe("JTL_143 Devastator", () => {
  it("When Played: deals 4 indirect damage to the opponent, assigned by YOU", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.devastator)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    const spread = played.lastDispatchResponse?.resolutionNeeded as NeedsSpreadDamage;
    expect(spread.type).toBe("SpreadDamage");
    expect(spread.totalDamage).toBe(4);
    expect(spread.assigningPlayer).toBe(1); // the Devastator's controller assigns, not the victim

    // Player 1 assigns all 4 to the enemy base.
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 4 }],
    });

    expect(g.state.player2.base.damage).toBe(4);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("the assigner can split the 4 between the enemy base and enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.jtl.devastator)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const enemyUnitPlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: "player2.base", damage: 1 },
        { playId: enemyUnitPlayId, damage: 3 },
      ],
    });

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("YOU assign indirect damage from OTHER sources too, while Devastator is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.devastator) // already in play
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage) // "Deal 5 indirect damage to a player"
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    const spread = g.lastDispatchResponse?.resolutionNeeded as NeedsSpreadDamage;
    expect(spread.totalDamage).toBe(5);
    expect(spread.assigningPlayer).toBe(1); // "ALL indirect damage you deal", not just Devastator's

    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 5 }],
    });
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("without a Devastator, the VICTIM still assigns (normal rules)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    const spread = g.lastDispatchResponse?.resolutionNeeded as NeedsSpreadDamage;
    expect(spread.assigningPlayer).toBe(2); // the victim assigns
  });

  it("does not let you assign the OPPONENT's indirect damage aimed at you", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.devastator) // player 1 has it
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 10)
        .WithCardInHandForPlayer(2, Cards.events.jtl.torpedoBarrage) // player 2 deals it
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-option", { option: "Opponent" }); // aimed at player 1

    const spread = g.lastDispatchResponse?.resolutionNeeded as NeedsSpreadDamage;
    // Player 1 is the victim here, so player 1 assigns — the same as normal rules.
    // The point is that Devastator grants nothing extra: it only covers damage YOU deal.
    expect(spread.assigningPlayer).toBe(1);
  });
});
