import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { computeSilencedPlayIds } from "@/server/engine/dispatch-listener";

// The Puzzles UI marks units whose abilities are blanked with an "X". The board state itself
// carries no such flag — losing abilities is derived from currentEffects via Unit.LostAbilities()
// — so the server ships the derived list alongside the state, exactly like sentinelPlayIds.
//
// JTL_018 Kazuda Xiono ("A friendly unit loses all abilities for this round") is the silencer
// used here; the same effect list also covers Force Lightning, Mind Trick et al.

function setup(resourceCount = 5) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.jtl.kazudaXiono)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount);
}

describe("computeSilencedPlayIds", () => {
  it("is empty while nothing has lost its abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(computeSilencedPlayIds(g.state)).toEqual([]);
  });

  it("lists a unit whose abilities have been blanked", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const silencedId = state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [silencedId] });

    expect(computeSilencedPlayIds(g.state)).toEqual([silencedId]);
  });

  it("ships the list on the dispatch response so the UI can render the marker", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
      .Build();
    g.loadNewState(state);
    const silencedId = state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [silencedId] });

    expect(g.lastDispatchResponse?.silencedPlayIds).toEqual([silencedId]);
  });

  it("covers enemy units too — the marker is not player-scoped", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
      .Build();
    g.loadNewState(state);
    // Blank an enemy unit directly: Kazuda only targets friendlies, but other silencers
    // (Force Lightning, Mind Trick) hit across the table.
    const enemy = { cardId: Cards.units.sor.battlefieldMarine, playId: "enemy-1", owner: 2 as const, controller: 2 as const, ready: true, damage: 0, upgrades: [], captives: [], numUses: 1, isClone: false };
    g.state.player2.groundArena.push(enemy);
    g.state.currentEffects.push({
      cardId: "LOF_202", // Mind Trick
      duration: "Round",
      affectedPlayer: 2,
      targetPlayId: "enemy-1",
    });

    expect(computeSilencedPlayIds(g.state)).toContain("enemy-1");
  });
});
