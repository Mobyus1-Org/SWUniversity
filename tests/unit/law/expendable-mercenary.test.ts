import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_159 Expendable Mercenary (3/3 Ground, Underworld/Bounty Hunter, cost 4)
// "When Defeated: You may resource this unit from its owner's discard pile."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithCardInHandForPlayer(1, Cards.events.sor.vanquish) // to defeat the mercenary
    .WithGroundUnitForPlayer(2, Cards.units.law.expendableMercenary);
}

describe("LAW_159 Expendable Mercenary", () => {
  it("When Defeated: its owner may resource it from their discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const resourcesBefore = g.state.player2.resources.length;

    await g.playCardFromHandAsync(1, 0); // Vanquish
    await g.chooseGroundUnitAsync(2, 0); // defeat the mercenary
    await g.chooseYesAsync(2); // its OWNER decides

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.resources).toHaveLength(resourcesBefore + 1);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.law.expendableMercenary)).toBe(true);
    // It moved OUT of the discard pile — it isn't in both places.
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.law.expendableMercenary)).toBe(false);
  });

  it("declining leaves it in the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const resourcesBefore = g.state.player2.resources.length;

    await g.playCardFromHandAsync(1, 0);
    const defeated = await g.chooseGroundUnitAsync(2, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(defeated.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(2);

    expect(g.state.player2.resources).toHaveLength(resourcesBefore);
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.law.expendableMercenary)).toBe(true);
  });

  it("the CONTROLLER resources it — a thief who steals and kills it keeps it", async () => {
    const g = new GameTestAdapter();
    // Player 1 steals it with No Glory, Only Results, then defeats it under their control.
    // The card goes to its owner's (player 2's) discard, but the ability belongs to its
    // controller — which is why the text says "from its OWNER's discard pile".
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
        .WithCardInHandForPlayer(1, Cards.events.jtl.noGloryOnlyResults)
        .WithGroundUnitForPlayer(2, Cards.units.law.expendableMercenary) // OWNED by player 2
        .Build(),
    );
    const p1ResourcesBefore = g.state.player1.resources.length;
    const p2ResourcesBefore = g.state.player2.resources.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // take control, then defeat it
    await g.chooseYesAsync(1); // player 1 controlled it at death, so player 1 chooses

    expect(g.state.player1.resources).toHaveLength(p1ResourcesBefore + 1); // the thief keeps it
    expect(g.state.player2.resources).toHaveLength(p2ResourcesBefore);
    const stolen = g.state.player1.resources.find(
      r => r.cardId === Cards.units.law.expendableMercenary,
    )!;
    expect(stolen.owner).toBe(2); // still owned by player 2
    expect(stolen.controller).toBe(1); // but controlled (and used) by player 1
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.law.expendableMercenary)).toBe(false);
  });
});
