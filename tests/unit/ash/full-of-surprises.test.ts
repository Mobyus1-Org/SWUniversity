import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_232 Full of Surprises (Event, cost 2)
// "Return an upgrade that costs 2 or less to its owner's hand."
// "Give a Shield token to a unit."

/** An upgrade already in play, owned and controlled by `player`. */
function upg(cardId: string, player: 1 | 2) {
  return { cardId, playId: "@", owner: player, controller: player };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_232 Full of Surprises", () => {
  it("returns a cheap upgrade to its owner's hand, then shields a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fullOfSurprises)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upg(Cards.upgrades.sor.academyTraining, 2)]) // cost 2
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.upgrades.sor.academyTraining);
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === "SOR_T02")).toHaveLength(1);
  });

  it("cannot target an upgrade costing more than 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fullOfSurprises)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upg(Cards.upgrades.sor.entrenched, 2)]) // cost 2 — legal
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [upg(Cards.upgrades.sor.jediLightsaber, 1)]) // cost 3 — too expensive
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([g.state.player2.groundArena[0].upgrades[0].playId]);
  });

  it("still gives the Shield token when there is no upgrade to return", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fullOfSurprises)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === "SOR_T02")).toHaveLength(1);
  });

  it("can shield an ENEMY unit (the clause says 'a unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fullOfSurprises)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].upgrades.filter(u => u.cardId === "SOR_T02")).toHaveLength(1);
  });

  it("does nothing when there is no unit and no upgrade in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fullOfSurprises)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("defeats a unit whose HP drops below its damage once the upgrade leaves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fullOfSurprises)
        // Battlefield Marine 3/3 with Academy Training (+2/+2) = 3/5, carrying 4 damage.
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 4)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upg(Cards.upgrades.sor.academyTraining, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 4 damage now exceeds its 3 HP
  });
});
