import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import type { NeedsTarget } from "@/lib/engine/message-types";

// The duplicate-unique defeat is an ordinary "Target" prompt, which the client labels
// "Choose a target." by default — saying nothing about what the choice does. It carries its own
// helperText so the player knows they are picking a unit to DEFEAT, not to buff or damage.
describe("uniqueness defeat prompt", () => {
  it("tells the player they are choosing a unit to defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen) // existing copy
        .WithCardInHandForPlayer(1, Cards.units.sor.colonelYularen) // second copy
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as NeedsTarget;
    expect(res.type).toBe("Target");
    expect(res.helperText).toBeDefined();
    expect(res.helperText).toMatch(/defeat/i);
  });

  it("control: an ordinary target prompt carries no helperText", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid) // "deal 2 damage to a unit or base"
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as NeedsTarget;
    expect(res.type).toBe("Target");
    expect(res.helperText).toBeUndefined();
  });
});
