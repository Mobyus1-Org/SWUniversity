import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_135 Scythe — Intimidating Silhouette (3/5 Space, Imperial/Vehicle/Transport/Inquisitor, cost 4)
//   "On Attack: You may give another friendly Inquisitor unit +2/+0 for this phase."
//
// "Another" excludes Scythe herself, and there is no arena restriction — a ground Inquisitor is a
// legal target for this space unit.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const powerOf = (g: GameTestAdapter, cardId: string) => {
  const u = [...g.state.player1.groundArena, ...g.state.player1.spaceArena].find(x => x.cardId === cardId)!;
  return Unit.FromInterface(u).CurrentPower();
};

describe("LOF_135 Scythe — On Attack", () => {
  it("gives another friendly Inquisitor +2/+0 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.lof.scythe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister) // 3/6 Ground Inquisitor
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(powerOf(g, Cards.units.sor.seventhSister)).toBe(5); // 3 + 2
  });

  it("declining leaves the Inquisitor alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.lof.scythe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);
    expect(afterTarget.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(powerOf(g, Cards.units.sor.seventhSister)).toBe(3);
  });

  it("'another' excludes Scythe herself, and enemy Inquisitors are not friendly", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.lof.scythe)
      .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister)
      .WithGroundUnitForPlayer(2, Cards.units.sor.seventhSister) // enemy Inquisitor
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const afterYes = await g.chooseYesAsync(1);

    const res = afterYes.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player1.spaceArena[0].playId); // Scythe
    expect(res.fromPlayIds).not.toContain(g.state.player2.groundArena[0].playId); // enemy
  });

  it("no prompt when Scythe is the only friendly Inquisitor (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.lof.scythe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not an Inquisitor
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);

    expect(afterTarget.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(3);
  });
});
