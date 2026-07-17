import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Unit } from "@/server/engine/unit";

// ASH_109 T-6 Shuttle 1974 (4/6/2 Space) — "Sentinel (Enemy units in this arena must attack a
// Sentinel when they attack you.)\nAction [Exhaust]: Give another unit +2/+2 for this phase.
// You may attack with that unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("ASH_109 T-6 Shuttle 1974 — Sentinel", () => {
  it("has printed Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974).Build());
    const shuttle = g.state.player1.spaceArena[0];
    expect(HasKeyword(Cards.units.ash.t6Shuttle1974, "Sentinel", shuttle.playId, 1)).toBe(true);
  });
});

describe("ASH_109 T-6 Shuttle 1974 — Action: give another unit +2/+2, may attack with it", () => {
  it("buffs the chosen unit and lets it attack", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.t6Shuttle1974, playId: shuttlePlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    const shuttle = g.state.player1.spaceArena.find(u => u.playId === shuttlePlayId)!;
    expect(shuttle.ready).toBe(false); // exhausted as the action cost

    // Marine: power 3 + 2 = 5 damage dealt to the enemy base.
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("may decline the attack — the buff still applies", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.t6Shuttle1974, playId: shuttlePlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    await g.chooseNoAsync(1);

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.ready).toBe(true); // never attacked
    // Power 3 + 2 = 5 — the buff landed even though the attack was declined.
    expect(Unit.FromInterface(marine).CurrentPower()).toBe(5);
  });

  it("does not offer the attack option when the chosen unit is already exhausted", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // exhausted
      .Build();
    g.loadNewState(state);

    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.t6Shuttle1974, playId: shuttlePlayId });
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(resp.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.ready).toBe(false);
  });

  it("can target itself is not required — targeting another friendly unit works with two units present", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
      .Build();
    g.loadNewState(state);

    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const marinePlayId = state.player1.groundArena[0].playId;

    const resp = await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ash.t6Shuttle1974, playId: shuttlePlayId });
    const resolution = resp.lastDispatchResponse?.resolutionNeeded;
    const targets = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];
    expect(targets).not.toContain(shuttlePlayId); // "another unit" excludes itself
    expect(targets).toContain(marinePlayId);
  });
});
