import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_040 Emergency Powers (Event) — "Choose a non-leader unit and pay any number of
// resources. For each resource paid this way, give an Experience token to the chosen unit."
//
// Same Credit rule as LOF_255 Curious Flock: a Credit is defeated to pay 1 resource LESS
// (CR 375), so it is not a resource paid and earns no Experience token.

const xpOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.experience).length;

const readyResources = (g: GameTestAdapter) =>
  g.state.player1.resources.filter(r => r.ready).length;

function buildState(opts: { credits?: number; resources?: number } = {}) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, opts.resources ?? 20)
    .WithCreditsForPlayer(1, opts.credits ?? 0)
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithCardInHandForPlayer(1, Cards.events.sec.emergencyPowers)
    .Build();
}

describe("SEC_040 Emergency Powers", () => {
  it("gives the chosen unit 1 Experience token per resource paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    const readyAfterPlay = readyResources(g);

    await g.chooseOptionAsync(1, "3");

    expect(xpOn(g.state.player1.groundArena[0])).toBe(3);
    expect(readyResources(g)).toBe(readyAfterPlay - 3);
  });

  it("can target an enemy non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "2");

    expect(xpOn(g.state.player2.groundArena[0])).toBe(2);
    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("cannot target a leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState());

    await g.playCardFromHandAsync(1, 0);
    // Without this the leader dispatch would be a no-op against an empty pending and the
    // rejection below would pass for the wrong reason.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    await g.chooseLeaderAsync(1);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    // The prompt is still live, so a legal non-leader target still resolves.
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "1");
    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
  });

  it("paying 0 grants no Experience tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    // Proves the payment prompt actually appeared, so "0 tokens" below is the card
    // resolving for zero rather than the ability never running.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    const readyAfterPlay = readyResources(g);

    await g.chooseOptionAsync(1, "0");

    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
    expect(readyResources(g)).toBe(readyAfterPlay);
  });

  describe("Credit interaction", () => {
    it("declining Credits pays full resources and grants the full Experience", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(buildState({ credits: 2 }));

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1); // don't spend Credits on the event's own cost
      await g.chooseGroundUnitAsync(1, 0);
      const readyAfterPlay = readyResources(g);

      await g.chooseOptionAsync(1, "3");
      await g.chooseNoAsync(1); // don't spend Credits on the Experience payment

      expect(xpOn(g.state.player1.groundArena[0])).toBe(3);
      expect(readyResources(g)).toBe(readyAfterPlay - 3);
      expect(g.state.player1.supplemental.creditTokens).toBe(2);
    });

    it("Credits defeated during the payment grant no Experience tokens", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(buildState({ credits: 2 }));

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1); // pay the event's own cost with resources
      await g.chooseGroundUnitAsync(1, 0);
      const readyAfterPlay = readyResources(g);

      await g.chooseOptionAsync(1, "3"); // declare 3
      await g.chooseYesAsync(1); // ...but cover part of it with Credits
      await g.chooseOptionAsync(1, "2"); // 2 Credits => only 1 resource actually paid

      expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
      expect(readyResources(g)).toBe(readyAfterPlay - 1);
      expect(g.state.player1.supplemental.creditTokens).toBe(0);
    });

    it("paying the event's own cost with Credits does not reduce the Experience earned", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(buildState({ credits: 1 }));

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1); // spend the lone Credit on the event's cost
      expect(g.state.player1.supplemental.creditTokens).toBe(0);
      await g.chooseGroundUnitAsync(1, 0);
      const readyAfterPlay = readyResources(g);

      await g.chooseOptionAsync(1, "4");

      expect(xpOn(g.state.player1.groundArena[0])).toBe(4);
      expect(readyResources(g)).toBe(readyAfterPlay - 4);
    });
  });
});
