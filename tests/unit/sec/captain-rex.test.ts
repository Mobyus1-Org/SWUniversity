import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SEC_048 Captain Rex - Into the Firefight (7/7 Ground, cost 6, Vigilance/Heroism) —
//   "When Played/When this unit completes an attack: Give this unit and an enemy unit Sentinel
//    for this phase."
// Mandatory, and it grants to BOTH sides — the enemy grant is filed under the enemy player, since
// the Sentinel dictionary reads effects scoped to the unit's own controller.
describe("SEC_048 Captain Rex - Into the Firefight", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
  }

  const rexOf = (g: GameTestAdapter) =>
    g.state.player1.groundArena.find(u => u.cardId === Cards.units.sec.captainRex)!;
  const sentinel = (u: { cardId: string; playId: string }, player: 1 | 2) =>
    HasSentinel(u.cardId, u.playId, player);

  it("When Played: Rex and the chosen enemy unit both gain Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.captainRex)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(sentinel(rexOf(g), 1)).toBe(true);
    expect(sentinel(g.state.player2.groundArena[0], 2)).toBe(true);
  });

  it("only the CHOSEN enemy gains it, not every enemy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.captainRex)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(sentinel(g.state.player2.groundArena[0], 2)).toBe(true);
    expect(sentinel(g.state.player2.groundArena[1], 2)).toBe(false);
  });

  it("with no enemy units, Rex still gains Sentinel and nothing is prompted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.sec.captainRex).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(sentinel(rexOf(g), 1)).toBe(true);
  });

  it("the enemy grant is real: it forces attacks onto that unit", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithCardInHandForPlayer(1, Cards.units.sec.captainRex)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // becomes the Sentinel
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // must be unattackable now
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0); // my Marine

    const res = await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [s.player2.groundArena[1].playId], // the NON-Sentinel one
    });
    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("When this unit completes an attack: it fires again", async () => {
    // The later of Rex's two trigger points — a When-Played-only wiring would pass every test
    // above and still be broken here.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.captainRex)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 — Rex survives
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // the defender
    await g.chooseGroundUnitAsync(2, 0); // Rex's ability target

    expect(sentinel(rexOf(g), 1)).toBe(true);
    expect(sentinel(g.state.player2.groundArena[0], 2)).toBe(true);
  });

  it("control: an ordinary unit's attack grants no Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // (The Marine dies to the 4-power counter — irrelevant here; what matters is no grant.)
    expect(sentinel(g.state.player2.groundArena[0], 2)).toBe(false);
  });
});
