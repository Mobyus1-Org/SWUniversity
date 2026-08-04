import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { CountBounties } from "@/server/engine/card-db/keyword-dictionaries.ts/bounty";

// SHD_173 Guild Target (Upgrade, Aggression, Bounty/Condition) —
//   "Attached unit gains: 'Bounty — Deal 2 damage to a base. If this unit is unique, deal 3 damage
//    instead.' (When this unit is defeated or captured, its opponent collects its bounty.)"
//
// It was half-wired: registered in the bounty COUNT dictionary, so HasBounty() was true and it
// looked implemented, but absent from getBountyEffects — so collecting it did nothing at all.
describe("SHD_173 Guild Target", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithActivePlayer(1);
  }

  /**
   * P1's Luke (6/7) kills the bountied P2 unit at ground index 0.
   *
   * Deliberately NOT a Wampa: it has Overwhelm, and its excess would spill onto the same base the
   * bounty damages — every assertion below would then be measuring two effects at once.
   */
  function boardWithHost(hostCardId: string, hostDamage = 0) {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker)
        .WithGroundUnitForPlayer(2, hostCardId, true, hostDamage)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.shd.guildTarget, 2),
        ])
        .Build(),
    );
    return g;
  }

  it("marks the attached unit as having a Bounty", () => {
    const g = boardWithHost(Cards.units.sor.battlefieldMarine);
    const host = g.state.player2.groundArena[0];
    expect(CountBounties(host.cardId, host.playId, 2)).toBeGreaterThan(0);
  });

  it("a NON-unique host deals 2 damage to the chosen base", async () => {
    const g = boardWithHost(Cards.units.sor.battlefieldMarine); // 3/3, not unique

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);             // collect the bounty
    await g.chooseBaseAsync(1, 2);         // point it at the enemy base

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("a UNIQUE host deals 3 instead", async () => {
    // 6/7 and unique; pre-damaged to 6 so the 6-power attacker finishes it.
    const g = boardWithHost(Cards.units.sor.lukeSkywalker, 6);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("declining the bounty deals nothing", async () => {
    const g = boardWithHost(Cards.units.sor.battlefieldMarine);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy(); // the prompt is real
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the collector may point it at their OWN base — the text says 'a base'", async () => {
    const g = boardWithHost(Cards.units.sor.battlefieldMarine);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("control: the same kill without Guild Target offers no bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker) // same killer, no Overwhelm
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
