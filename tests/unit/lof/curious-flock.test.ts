import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_255 Curious Flock — "When Played: Pay up to 6 resources. For each resource paid
// this way, give an Experience token to this unit."
//
// The Credit token (LAW_T01) reads "While paying resources, you may defeat this token.
// If you do, pay 1 resource LESS" — so a Credit reduces the resources paid rather than
// standing in for one. "For each resource paid this way" therefore counts only the
// resources actually exhausted; Credits never contribute an Experience token.

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
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, opts.resources ?? 14)
    .WithCreditsForPlayer(1, opts.credits ?? 0)
    .WithCardInHandForPlayer(1, Cards.units.lof.curiousFlock)
    .Build();
}

describe("LOF_255 Curious Flock", () => {
  it("gives 1 Experience token per resource paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState());

    await g.playCardFromHandAsync(1, 0);
    const readyAfterPlay = readyResources(g);

    await g.chooseOptionAsync(1, "3");

    expect(xpOn(g.state.player1.groundArena[0])).toBe(3);
    expect(readyResources(g)).toBe(readyAfterPlay - 3);
  });

  it("caps the payment at 6 even with more resources available", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState({ resources: 14 }));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "7");

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);

    // The prompt is still live, so the legal maximum still resolves.
    await g.chooseOptionAsync(1, "6");
    expect(xpOn(g.state.player1.groundArena[0])).toBe(6);
  });

  it("paying 0 leaves the unit in play with no Experience tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildState());

    await g.playCardFromHandAsync(1, 0);
    const readyAfterPlay = readyResources(g);

    await g.chooseOptionAsync(1, "0");

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
    expect(readyResources(g)).toBe(readyAfterPlay);
  });

  describe("Credit interaction", () => {
    it("declining Credits pays full resources and grants the full Experience", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(buildState({ credits: 2 }));

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1); // don't spend Credits on the card's own cost
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
      await g.chooseNoAsync(1); // pay the card's own cost with resources
      const readyAfterPlay = readyResources(g);

      await g.chooseOptionAsync(1, "3"); // declare 3
      await g.chooseYesAsync(1); // ...but cover part of it with Credits
      await g.chooseOptionAsync(1, "2"); // 2 Credits => only 1 resource actually paid

      // 3 declared, 2 covered by Credits => 1 resource exhausted => 1 Experience token.
      expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
      expect(readyResources(g)).toBe(readyAfterPlay - 1);
      expect(g.state.player1.supplemental.creditTokens).toBe(0);
    });

    it("grants no Experience for Credits the player is forced to defeat", async () => {
      const g = new GameTestAdapter();
      // 2 resources: one pays the Flock's own cost, leaving a single ready resource.
      g.loadNewState(buildState({ credits: 2, resources: 2 }));

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1); // pay the 1-cost Flock with a resource
      expect(readyResources(g)).toBe(1);

      // Declaring 3 with only 1 ready resource forces both Credits — no prompt, no choice.
      await g.chooseOptionAsync(1, "3");

      expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
      expect(readyResources(g)).toBe(0);
      expect(g.state.player1.supplemental.creditTokens).toBe(0);
    });

    it("paying the card's own cost with a Credit does not reduce the Experience earned", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(buildState({ credits: 1 }));

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1); // spend the lone Credit on the Flock's 1 cost
      expect(g.state.player1.supplemental.creditTokens).toBe(0);
      const readyAfterPlay = readyResources(g);

      // The two payments are independent: no Credits remain, so all 4 come from resources.
      await g.chooseOptionAsync(1, "4");

      expect(xpOn(g.state.player1.groundArena[0])).toBe(4);
      expect(readyResources(g)).toBe(readyAfterPlay - 4);
    });
  });
});
