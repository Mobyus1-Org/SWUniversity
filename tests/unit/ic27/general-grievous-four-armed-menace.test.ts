import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { NeedsOption } from "@/lib/engine/message-types";

// IC27_021 General Grievous — Four-Armed Menace (4/5 Ground, cost 4, Vigilance/Villainy) —
//   "When you play an upgrade on this unit: Choose one that hasn't been chosen this phase:
//    Give an Experience token to him. / Heal 3 damage from your base. / Draw a card."
//
// The memory is per phase: each mode can be picked once, so three upgrades in one phase use all
// three and a fourth does nothing. Token upgrades are GIVEN, not played, so they never trigger it.

const GRIEVOUS = Cards.units.ic27.generalGrievousFourArmedMenace;
const RESILIENT = Cards.upgrades.sor.resilient; // cost 1, +0/+3, no text
const MARINE = Cards.units.sor.battlefieldMarine;
const XP = Cards.upgrades.token.experience;

function setup(upgradesInHand = 1) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.idenVersio) // Vigilance/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, GRIEVOUS)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(1);
  for (let i = 0; i < upgradesInHand; i++) b.WithCardInHandForPlayer(1, RESILIENT);
  return b;
}

const offered = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as NeedsOption | undefined)?.options ?? null;

async function playUpgradeOnGrievous(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseGroundUnitAsync(1, 0);
}

describe("IC27_021 General Grievous — Four-Armed Menace", () => {
  it("offers all three modes when an upgrade is played on him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await playUpgradeOnGrievous(g);

    expect(offered(g)).toEqual(["experience", "heal", "draw"]);
  });

  it("Experience: gives him an Experience token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await playUpgradeOnGrievous(g);
    await g.chooseOptionAsync(1, "experience");

    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === XP).length).toBe(1);
  });

  it("Heal: heals 3 damage from your base", async () => {
    const g = new GameTestAdapter();
    const state = setup().Build();
    state.player1.base.damage = 5;
    g.loadNewState(state);

    await playUpgradeOnGrievous(g);
    await g.chooseOptionAsync(1, "heal");

    expect(g.state.player1.base.damage).toBe(2);
  });

  it("Draw: draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await playUpgradeOnGrievous(g);
    await g.chooseOptionAsync(1, "draw");

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("a mode chosen this phase is not offered again, and all three spent means no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4).Build());

    await playUpgradeOnGrievous(g);
    await g.chooseOptionAsync(1, "draw");
    await g.dispatchAsync(2, "pass-action", {});

    await playUpgradeOnGrievous(g);
    expect(offered(g)).toEqual(["experience", "heal"]);
    await g.chooseOptionAsync(1, "heal");
    await g.dispatchAsync(2, "pass-action", {});

    await playUpgradeOnGrievous(g);
    expect(offered(g)).toEqual(["experience"]);
    await g.chooseOptionAsync(1, "experience");
    await g.dispatchAsync(2, "pass-action", {});

    await playUpgradeOnGrievous(g);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === RESILIENT).length).toBe(4);
  });

  it("records each chosen mode as a Phase effect, so the memory resets next phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await playUpgradeOnGrievous(g);
    await g.chooseOptionAsync(1, "draw");

    const memo = g.state.currentEffects.filter(e => e.cardId.startsWith("IC27_021"));
    expect(memo.length).toBe(1);
    expect(memo[0].duration).toBe("Phase");
  });

  it("an upgrade played on ANOTHER unit does not trigger him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1); // the Marine

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("an OPPONENT playing an upgrade on him does not trigger it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.idenVersio)
        .TheirBase(Cards.bases.common.blue30HP)
        .TheirLeader(Cards.leaders.sor.idenVersio)
        .FillResourcesForPlayer(2, MARINE, 14)
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithCardInHandForPlayer(2, RESILIENT)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === RESILIENT)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
