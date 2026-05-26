import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_082 Chancellor Palpatine — When Played: If you control a leader unit,
// create 2 Spy tokens and give those tokens Sentinel for this phase.
// Aspects: Command+Villainy (covered by Moff Gideon leader).

describe("SEC_082 Chancellor Palpatine", () => {
  it("creates 2 Spy tokens with Sentinel effect when leader unit is deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon, true, true) // deployed
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.units.sec.chancellorPalpatine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const spyTokens = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.spy);
    expect(spyTokens).toHaveLength(2);

    const sentinelEffects = g.state.currentEffects.filter(
      e => e.cardId === "SEC_082" && e.affectedPlayer === 1 && e.duration === "Phase",
    );
    expect(sentinelEffects).toHaveLength(2);
    expect(sentinelEffects[0].targetPlayId).toBe(spyTokens[0].playId);
    expect(sentinelEffects[1].targetPlayId).toBe(spyTokens[1].playId);
  });

  it("does nothing when leader is not deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon) // not deployed
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.units.sec.chancellorPalpatine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const spyTokens = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.spy);
    expect(spyTokens).toHaveLength(0);

    const sentinelEffects = g.state.currentEffects.filter(e => e.cardId === "SEC_082");
    expect(sentinelEffects).toHaveLength(0);
  });
});
