import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Cards } from "../../card-helpers";

// ASH_254 Gallofree Transport (3/5 Space, cost 4)
// "When Defeated: Give 2 Advantage tokens to a friendly unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_254 Gallofree Transport", () => {
  it("gives 2 Advantage tokens to a chosen friendly unit when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.gallofreeTransport, true, 4) // 5 HP, 4 damage
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0); // 4 damage finishes the Transport
    await g.chooseGroundUnitAsync(1, 0); // When Defeated target

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(2);
  });

  it("cannot give the tokens to an ENEMY unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.gallofreeTransport, true, 4)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toContain(g.state.player1.groundArena[0].playId);
    expect(targets).not.toContain(g.state.player2.spaceArena[0].playId);
  });

  it("fizzles quietly when no friendly unit survives it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.gallofreeTransport, true, 4)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
