import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_130 Fang Fighter Squadron (5/5 Space, cost 5)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// Fang Fighter Squadron has no other abilities, so it is the clean test of Support's own behaviour:
// the prompt, the choice of attacker, and the attack itself.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.fangFighterSquadron);
}

describe("ASH_130 Fang Fighter Squadron", () => {
  it("Support: a friendly unit you choose attacks when this unit is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3, the supported attacker
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);          // use Support
    await g.chooseGroundUnitAsync(1, 0); // the Marine attacks
    await g.chooseBaseAsync(1, 2);       // …the enemy base

    expect(g.state.player2.base.damage).toBe(3); // the Marine's 3 power
    expect(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.fangFighterSquadron)).toBeDefined();
  });

  it("the supporting unit does not attack itself — it sends another unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    // The Support prompt must actually appear, or "Yes" below would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    // Only the Marine is offered — Fang Fighter Squadron itself is not a legal choice.
    const fang = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.fangFighterSquadron)!;
    const marine = g.state.player1.groundArena[0];
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    const offered = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];
    expect(offered).toContain(marine.playId);
    expect(offered).not.toContain(fang.playId);
  });

  it("declining Support attacks with nobody", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena[0].ready).toBe(true); // the Marine never attacked
  });

  it("no prompt when there is no other unit to attack with", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build()); // no other friendly unit

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.spaceArena).toHaveLength(1); // it still entered play
  });
});
