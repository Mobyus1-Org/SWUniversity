import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

const EXPERIENCE = Cards.upgrades.token.experience;
const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === EXPERIENCE).length;

// SEC_119 Crucible - Centuries of Wisdom (5/5 Space, cost 6) —
//   "When Played/When Defeated: Give an Experience token to each other friendly unit."
// Both halves are automatic — there is no choice to make.
describe("SEC_119 Crucible - Centuries of Wisdom", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // Command — no aspect penalty
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
  }

  it("When Played: gives one token to each OTHER friendly unit, in both arenas", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithCardInHandForPlayer(1, Cards.units.sec.crucible)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(xp(g.state.player1.groundArena[0])).toBe(1);
    expect(xp(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.tieLnFighter)!)).toBe(1);
    // "OTHER" — Crucible never tokens herself.
    expect(xp(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sec.crucible)!)).toBe(0);
  });

  it("When Played: gives nothing to ENEMY units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sec.crucible)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(xp(g.state.player2.groundArena[0])).toBe(0);
  });

  it("When Defeated: gives one token to each surviving friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.sec.crucible)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // Rival's Fall on my own Crucible

    expect(g.state.player1.spaceArena.length).toBe(0);
    expect(xp(g.state.player1.groundArena[0])).toBe(1);
    expect(xp(g.state.player2.groundArena[0])).toBe(0); // still friendly-only
  });

  it("both triggers stack when she is played and later defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sec.crucible)
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(xp(g.state.player1.groundArena[0])).toBe(1);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(xp(g.state.player1.groundArena[0])).toBe(2);
  });

  it("resolves cleanly with no other friendly unit to token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.sec.crucible).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sec.crucible)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("control: a plain unit entering play gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });
});
