import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

const EXPERIENCE = Cards.upgrades.token.experience;
const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === EXPERIENCE).length;

// SHD_096 Maz Kanata - Pirate Queen (1/1 Ground, cost 1) —
//   "When you play another unit: Give an Experience token to this unit."
describe("SHD_096 Maz Kanata - Pirate Queen", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gains an Experience token when you play another unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.shd.mazKanata)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const maz = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.mazKanata)!;
    expect(xpOn(maz)).toBe(1);
  });

  it("stacks across multiple units played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.shd.mazKanata)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    const maz = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.mazKanata)!;
    expect(xpOn(maz)).toBe(2);
  });

  it("does NOT trigger off her own entry ('another unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.units.shd.mazKanata)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const maz = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.mazKanata)!;
    expect(xpOn(maz)).toBe(0);
  });

  it("does NOT trigger when the OPPONENT plays a unit ('when YOU play')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.shd.mazKanata)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);

    const maz = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.mazKanata)!;
    expect(xpOn(maz)).toBe(0);
  });

  it("does NOT trigger off a non-unit card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.shd.mazKanata)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const maz = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.mazKanata)!;
    expect(xpOn(maz)).toBe(0);
  });

  it("does not trigger while she has lost her abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.shd.mazKanata)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "@", owner: 2, controller: 2 },
        ])
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const maz = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.mazKanata)!;
    expect(xpOn(maz)).toBe(0);
  });
});
