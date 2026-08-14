import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { CardCost } from "@/server/engine/card-db/generated";
import { Cards } from "../../card-helpers";

// JTL_148 Frisk — Vanguard Loudmouth (3/2 Ground New Republic Pilot) —
//   "Piloting [2 resources]"
//   "When played as an upgrade: You may defeat an upgrade that costs 2 or less."
function upgradeOn(cardId: string, owner: 1 | 2) {
  return { cardId, playId: "@", owner, controller: owner };
}

// SOR_120 Academy Training costs 2 (defeatable); SOR_122 Devotion costs 3 (not).
const CHEAP_UPGRADE = Cards.upgrades.sor.academyTraining;

function setup() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.jtl.frisk)
      // A friendly vehicle for Frisk to pilot.
      .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
      // An enemy unit carrying a cheap upgrade to defeat.
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [upgradeOn(CHEAP_UPGRADE, 2)])
      .Build(),
  );
  return g;
}

describe("JTL_148 Frisk", () => {
  it("has Piloting", () => {
    setup();
    expect(HasKeyword(Cards.units.jtl.frisk, "Piloting")).toBe(true);
  });

  it("the cheap upgrade in the fixture really does cost 2 or less", () => {
    expect(CardCost(CHEAP_UPGRADE)).toBeLessThanOrEqual(2);
  });

  it("played as an upgrade, may defeat an upgrade costing 2 or less", async () => {
    const g = setup();

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("declining leaves the upgrade in play", async () => {
    const g = setup();

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    const attached = await g.choosePilotVehicleSpaceAsync(1, 0);
    // Dispatching an option with no pending is a silent no-op, so prove the prompt exists.
    expect(attached.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    const res = await g.chooseNoAsync(1);

    expect(res.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });

  // "When played as an upgrade" — playing Frisk as an ordinary unit must not offer the ability.
  it("does not trigger when played as a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.units.jtl.frisk)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [upgradeOn(CHEAP_UPGRADE, 2)])
        .Build(),
    );

    // No friendly vehicle exists, so this play resolves Frisk as an ordinary unit.
    const res = await g.playCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(res.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });
});
