import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_183 B-Wing Skirmisher (4/4 Space) —
// "When Played: Deal 1 damage to each of up to 2 space units."
function setup() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.law.bWingSkirmisher)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build(),
  );
  return g;
}

describe("LAW_183 B-Wing Skirmisher", () => {
  it("deals 1 damage to each of 2 chosen space units", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);

    const [first, second] = g.state.player2.spaceArena;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [first.playId, second.playId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
    expect(g.state.player2.spaceArena[1].damage).toBe(1);
  });

  it("deals 1 damage when only one unit is chosen", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);

    const first = g.state.player2.spaceArena[0];
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [first.playId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
    expect(g.state.player2.spaceArena[1].damage).toBe(0);
  });

  // "up to 2" — choosing none is legal and must damage nothing.
  it("deals no damage when no unit is chosen", async () => {
    const g = setup();
    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player2.spaceArena[1].damage).toBe(0);
  });

  // "space units" — the ground unit must not be offered.
  it("offers only space units, capped at 2", async () => {
    const g = setup();
    const played = await g.playCardFromHandAsync(1, 0);

    const resolution = played.lastDispatchResponse?.resolutionNeeded;
    const target = resolution?.type === "Target" ? resolution : undefined;
    const offered = target?.fromPlayIds ?? [];
    const groundPlayId = g.state.player2.groundArena[0].playId;

    expect(offered).not.toContain(groundPlayId);
    expect(offered).toHaveLength(3); // 2 enemy space units + the Skirmisher itself
    expect(target?.maxTargets).toBe(2);
    expect(target?.needsMultiple).toBe(true);
  });
});
