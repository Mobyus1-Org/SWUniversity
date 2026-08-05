import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import type { NeedsSpreadDamage } from "@/lib/engine/message-types";
import { Unit } from "@/server/engine/unit";

// JTL_171 Targeting Computer (Upgrade, cost 1, Item/Modification, +1/+1) —
//   "Attached unit gains: 'You assign all indirect damage dealt by this unit.'"
//
// The per-unit sibling of Devastator's player-wide override. Normally the victim divides indirect
// damage; with this attached, the unit's controller does.
describe("JTL_171 Targeting Computer", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // something to attack
      .WithActivePlayer(1);
  }

  /** Red Squadron Y-Wing's On Attack deals 3 indirect to the defending player. */
  function yWingAttacks(withComputer: boolean) {
    let b = base().WithSpaceUnitForPlayer(1, Cards.units.jtl.redSquadronYWing);
    if (withComputer) {
      b = b.WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.jtl.targetingComputer, 1),
      ]);
    }
    const g = new GameTestAdapter();
    g.loadNewState(b.Build());
    return g;
  }

  const assigningPlayer = (g: GameTestAdapter) => {
    const res = g.lastDispatchResponse?.resolutionNeeded;
    return res?.type === "SpreadDamage" ? (res as NeedsSpreadDamage).assigningPlayer : undefined;
  };

  it("the attached unit's controller assigns the indirect damage", async () => {
    const g = yWingAttacks(true);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(assigningPlayer(g)).toBe(1); // the dealer, not the victim
  });

  it("control: without it, the victim assigns", async () => {
    const g = yWingAttacks(false);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(assigningPlayer(g)).toBe(2);
  });

  it("the dealer's assignment is applied as chosen", async () => {
    const g = yWingAttacks(true);
    const enemyPlayId = g.state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: enemyPlayId, damage: 3 }],
    });

    // The Y-Wing is 1/3 but the Computer is +1/+1, so 2 combat damage, plus the 3 indirect the
    // dealer aimed at the same unit.
    expect(g.state.player2.spaceArena[0].damage).toBe(5);
  });

  it("grants its printed +1/+1", () => {
    const g = yWingAttacks(true);
    const yWing = Unit.FromInterface(g.state.player1.spaceArena[0]);

    expect(yWing.CurrentPower()).toBe(2); // 1 + 1
    expect(yWing.TotalHP()).toBe(4);      // 3 + 1
  });

  it("only overrides for the unit carrying it", async () => {
    // The computer sits on a bystander; the Y-Wing deals the damage, so the victim still assigns.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.redSquadronYWing)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithUpgradesOnSpaceUnitForPlayer(1, 1, [
          GameStateBuilder.Upgrade(Cards.upgrades.jtl.targetingComputer, 1),
        ])
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0); // the Y-Wing
    await g.chooseSpaceUnitAsync(2, 0);

    expect(assigningPlayer(g)).toBe(2);
  });
});
