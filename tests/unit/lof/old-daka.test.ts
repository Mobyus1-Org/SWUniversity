import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// LOF_036 Old Daka — Oldest and Wisest (6/6 Ground, Force/Night, cost 5)
//   "When Played: You may defeat a friendly Night unit not named Old Daka.
//    Then, you may play that unit from your discard pile for free."
//
// Two independent "may"s: you can decline the defeat outright, or defeat and then decline the
// replay. "Not named Old Daka" is matched by title, so another printing of her is excluded too.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.units.lof.oldDaka);
}

const specters = (g: GameTestAdapter) =>
  g.state.player1.groundArena.filter(u => u.cardId === Cards.units.lof.awakenedSpecters);

describe("LOF_036 Old Daka", () => {
  it("defeats the chosen friendly Night unit and replays it from the discard for free", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.awakenedSpecters).Build();
    g.loadNewState(state);
    const victimPlayId = state.player1.groundArena[0].playId;
    const resourcesBefore = g.state.player1.resources.filter(r => r.ready).length;
    const dakaCost = playCost(g.state, 1, Cards.units.lof.oldDaka);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victimPlayId] });

    // Back on the board, and free — the only resources spent were Old Daka's own cost.
    expect(specters(g)).toHaveLength(1);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.lof.awakenedSpecters)).toBe(false);
    const spent = resourcesBefore - g.state.player1.resources.filter(r => r.ready).length;
    expect(spent).toBe(dakaCost); // Old Daka's own cost only; the replay cost nothing
  });

  it("declining the defeat leaves everything alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.awakenedSpecters).Build());

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(specters(g)).toHaveLength(1);
    expect(g.state.player1.discard).toHaveLength(0);
  });

  it("defeating but declining the replay leaves the unit in the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.awakenedSpecters).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(specters(g)).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.lof.awakenedSpecters);
  });

  it("only friendly NIGHT units are offered, and never a unit named Old Daka", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.lof.awakenedSpecters)      // Night — eligible
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)     // not Night
      .WithGroundUnitForPlayer(2, Cards.units.lof.talzinsAssassin)       // enemy Night
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const afterYes = await g.chooseYesAsync(1);

    const res = afterYes.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(state.player1.groundArena[0].playId);   // Specters
    expect(res.fromPlayIds).not.toContain(state.player1.groundArena[1].playId); // Marine
    expect(res.fromPlayIds).not.toContain(state.player2.groundArena[0].playId); // enemy Night
    // The Old Daka who just entered play is herself a friendly Night unit — excluded by name.
    const dakaInPlay = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.oldDaka)!;
    expect(res.fromPlayIds).not.toContain(dakaInPlay.playId);
  });

  it("no prompt when there is no other friendly Night unit (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.discard).toHaveLength(0);
  });
});
