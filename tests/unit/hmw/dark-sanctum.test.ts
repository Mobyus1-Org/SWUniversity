import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasFortify } from "@/server/engine/card-db/keyword-dictionaries.ts/fortify";

// HMW_070 Dark Sanctum (Upgrade, cost 3, Vigilance/Villainy, Fortification) —
//   "Fortify (Attach this to your base, not a unit.)"
//   "Attached base gains: 'When the regroup phase starts: Draw a card and deal 2 damage to this
//    base.'"
//
// A Fortify upgrade that grants the BASE a regroup-start ability. The engine already fires
// regroup-start abilities for units and for upgrades attached to units; nothing walked BASE
// upgrades, so this needed a third table.
//
// "This base" is the attached one, so the draw and the damage both land on that base's controller
// — it costs you 2 base HP a round to draw an extra card.

const SANCTUM = "HMW_070";
const MARINE = Cards.units.sor.battlefieldMarine;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
  // Deep enough decks that the regroup draws never run dry.
  for (let i = 0; i < 10; i++) b = b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
  return b;
}

async function passTheRound(g: GameTestAdapter) {
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.passResourceAsync(g.state.activePlayer);
  await g.passResourceAsync(g.state.activePlayer);
}

describe("HMW_070 Dark Sanctum", () => {
  it("has Fortify", () => {
    expect(HasFortify(SANCTUM)).toBe(true);
  });

  it("deals 2 damage to the attached base when regroup starts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnBaseForPlayer(1, [up(SANCTUM, 1)]).Build());

    await passTheRound(g);

    expect(g.state.player1.base.damage).toBe(2);
  });

  it("draws its controller an extra card", async () => {
    // Regroup draws on its own, so this is measured against an identical board with no Sanctum.
    const control = new GameTestAdapter();
    control.loadNewState(setup().Build());
    await passTheRound(control);
    const baseline = control.state.player1.hand.length;

    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnBaseForPlayer(1, [up(SANCTUM, 1)]).Build());
    await passTheRound(g);

    expect(g.state.player1.hand.length).toBe(baseline + 1);
  });

  it("leaves the opponent's base and hand alone", async () => {
    const control = new GameTestAdapter();
    control.loadNewState(setup().Build());
    await passTheRound(control);
    const theirBaseline = control.state.player2.hand.length;

    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnBaseForPlayer(1, [up(SANCTUM, 1)]).Build());
    await passTheRound(g);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player2.hand.length).toBe(theirBaseline);
  });

  it("fires for the OPPONENT's Sanctum against their own base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnBaseForPlayer(2, [up(SANCTUM, 2)]).Build());

    await passTheRound(g);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("two copies fire twice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup().WithUpgradesOnBaseForPlayer(1, [up(SANCTUM, 1), { ...up(SANCTUM, 1), playId: "@2" }]).Build(),
    );

    await passTheRound(g);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("fires again the next round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnBaseForPlayer(1, [up(SANCTUM, 1)]).Build());

    await passTheRound(g);
    expect(g.state.player1.base.damage).toBe(2);

    await passTheRound(g);
    expect(g.state.player1.base.damage).toBe(4);
  });

  it("does nothing while nothing is attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await passTheRound(g);

    expect(g.state.player1.base.damage).toBe(0);
  });
});
