import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_156 R5-D4 (3/4 Ground, cost 3)
// "Support (…)"
// "On Attack: Defeat all upgrades on the defending unit."

function upgrade(cardId: string) {
  return { cardId, playId: "@", owner: 2 as const, controller: 2 as const };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_156 R5-D4", () => {
  it("On Attack: defeats every upgrade on the defending unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.r5d4)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          upgrade(Cards.upgrades.token.shield),
          upgrade(Cards.upgrades.token.experience),
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Both upgrades are gone before combat, so the Shield can't absorb R5-D4's 3 damage:
    // a 3/3 Marine (no longer +1/+1 from Experience) takes 3 and dies.
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Support grants the On Attack — the supported attacker strips the upgrades", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upgrade(Cards.upgrades.token.shield)])
        .WithCardInHandForPlayer(1, Cards.units.ash.r5d4)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // Shield stripped, 3 damage killed it
  });

  it("does nothing special against an unupgraded defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.r5d4)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(3); // took the counter-damage
  });
});
