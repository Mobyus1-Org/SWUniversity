import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_022 Mystic Monastery (Base, 25 HP, Command)
//   "Action: The Force is with you (create your Force token).
//    Use this ability no more than 3 times each game."
//
// A plain Action, not an Epic Action: it does not exhaust anything and is usable repeatedly, but
// only 3 times over the WHOLE game — the cap must survive the round rolling over.

/** Passes both players' actions, then both regroup steps, landing in the next action phase. */
async function advanceToNextActionPhase(g: GameTestAdapter) {
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-resource", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-resource", {});
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.lof.mysticMonastery)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine);
}

const force = (g: GameTestAdapter) => g.state.player1.supplemental.forceToken === true;

describe("LOF_022 Mystic Monastery", () => {
  it("creates your Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    expect(force(g)).toBe(false);

    await g.useBaseAbilityAsync(1);

    expect(force(g)).toBe(true);
  });

  it("does not use the Epic Action — it stays available", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.useBaseAbilityAsync(1);

    expect(g.state.player1.base.epicActionUsed).toBeFalsy();
  });

  it("is usable 3 times, and the 4th is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    for (let i = 0; i < 3; i++) {
      const used = await g.useBaseAbilityAsync(1);
      expect(used.lastDispatchResponse?.invalidAction).toBeFalsy();
      // Spend the token so the next use has something to do.
      g.state.player1.supplemental.forceToken = false;
      await g.dispatchAsync(2, "pass-action", {});
    }

    const fourth = await g.useBaseAbilityAsync(1);
    expect(fourth.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("the 3-use cap is per GAME — it does not reset next round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    for (let i = 0; i < 3; i++) {
      await g.useBaseAbilityAsync(1);
      g.state.player1.supplemental.forceToken = false;
      await g.dispatchAsync(2, "pass-action", {});
    }
    await advanceToNextActionPhase(g);

    const afterRound = await g.useBaseAbilityAsync(1);
    expect(afterRound.lastDispatchResponse?.invalidAction).toBe(true);
    expect(force(g)).toBe(false);
  });

  it("only the Monastery's controller gets the token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.useBaseAbilityAsync(1);

    expect(g.state.player2.supplemental.forceToken).toBeFalsy();
  });
});
