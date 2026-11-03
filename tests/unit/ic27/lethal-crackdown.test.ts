import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_030 is a reprint of TWI_041: same text and stats, so this mirrors TWI_041's tests.

// IC27_030 Lethal Crackdown (Event, cost 4)
// "Defeat a non-leader unit. Deal damage to your base equal to that unit's power."

const CRACKDOWN = Cards.events.ic27.lethalCrackdown;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, CRACKDOWN);
}

describe("IC27_030 Lethal Crackdown", () => {
  it("defeats the chosen unit and damages YOUR base by its power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(4); // the caster's base, not the victim's
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("measures CURRENT power, not printed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(2, WAMPA)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.base.damage).toBe(6); // 4 + 2 from Academy Training
  });
});
