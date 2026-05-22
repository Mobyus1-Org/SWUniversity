import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// JTL_096 Blue Leader (Unit, cost 3, Command+Heroism, Space, 3/3):
//   Ambush
//   When Played: You may pay 2 resources. If you do, move this unit to the ground
//   arena and give 2 Experience tokens to it.
//
// green30HP (SOR_023) = Command aspect → covers Blue Leader (no aspect penalty).
// 5 ready resources covers cost 3 (play) + 2 (pay-to-move).
//
// TIE Fighter token (JTL_T01): 1/1 Space — weak enough that Blue Leader survives.

function blueLeaderSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren, false)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
    .WithCardInHandForPlayer(1, Cards.units.jtl.blueLeader);
}

describe("Move Unit — Blue Leader (JTL_096)", () => {
  it("When Played first: pay 2 to move to ground, then Ambush into a ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      blueLeaderSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 ground — ambush target
        .Build(),
    );

    // Play Blue Leader → trigger-order prompt with Ambush and When Played options
    await g.playCardFromHandAsync(1, 0);
    let res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    expect((res as { options?: string[] }).options).toContain("Blue Leader — When Played");
    expect((res as { options?: string[] }).options).toContain("Blue Leader — Ambush");

    // Pick When Played first → pay-to-move prompt
    await g.chooseOptionAsync(1, "Blue Leader — When Played");
    res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");

    // "Yes" → pay 2, Blue Leader moves to ground arena with 2 Experience tokens
    await g.chooseYesAsync(1);

    // Blue Leader is now in P1's ground arena (not space)
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    const bl = g.state.player1.groundArena[0];
    expect(bl.cardId).toBe(Cards.units.jtl.blueLeader);
    expect(bl.upgrades).toHaveLength(2);
    expect(bl.upgrades[0].cardId).toBe(Cards.upgrades.token.experience);
    expect(bl.upgrades[1].cardId).toBe(Cards.upgrades.token.experience);

    // Ambush prompt fires next (now attacking from ground arena)
    res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");

    // "Yes" → choose P2's marine as the ambush target
    await g.chooseYesAsync(1);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // Blue Leader 3+2exp=5 power vs Marine 3 HP → marine dies.
    // Marine 3 power vs Blue Leader 5 HP → Blue Leader survives with 2 HP remaining.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("Ambush first into weak space unit (survives), then pay 2 to move to ground", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      blueLeaderSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.token.tieFighter) // 1/1 space — Blue Leader survives
        .Build(),
    );

    // Play Blue Leader → trigger-order prompt
    await g.playCardFromHandAsync(1, 0);
    let res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");

    // Pick Ambush first
    await g.chooseOptionAsync(1, "Blue Leader — Ambush");
    res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");

    // "Yes" → attack the TIE Fighter
    await g.chooseYesAsync(1);
    const tiePlayId = g.state.player2.spaceArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [tiePlayId] });

    // TIE Fighter dies (1 HP vs Blue Leader's 3 power), Blue Leader takes 1 damage (3-1=2 HP left)
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player1.spaceArena).toHaveLength(1); // still in space arena
    expect(g.state.player1.spaceArena[0].damage).toBe(1);

    // pay-to-move prompt fires after combat
    res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");

    // "Yes" → pay 2, move to ground + 2 Experience
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    const bl = g.state.player1.groundArena[0];
    expect(bl.cardId).toBe(Cards.units.jtl.blueLeader);
    expect(bl.damage).toBe(1);          // damage from the space fight persists
    expect(bl.upgrades).toHaveLength(2);
    expect(bl.upgrades[0].cardId).toBe(Cards.upgrades.token.experience);
    expect(bl.upgrades[1].cardId).toBe(Cards.upgrades.token.experience);
  });
});
