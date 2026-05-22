import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// Luke Skywalker JTL_094 (Ground, 2/3, cost 2, Command+Heroism, Pilot):
//   "You Still With Me?" — When defeated as a pilot upgrade, you may move this
//   unit to your ground arena exhausted.
//
// L3-37 JTL_049 (Ground, 3/3, cost 3, Vigilance+Heroism, Pilot):
//   "If this unit would be defeated, you may instead attach her as an upgrade
//   to a friendly Vehicle unit without a Pilot on it."
//
// Millennium Falcon JTL_249 (Space, Vehicle, 3/4, cost 3, Heroism).
// Red Squadron X-Wing JTL_051 (Space, Vehicle, 4/3, cost 3, Vigilance+Heroism).
// R2-D2 JTL_245 (Ground, 4/1, cost 1, PilotingCost=0): counts as a pilot.
//
// SOR_251 Confiscate (Event, cost 1, Law) → costs 1+2=3 without a Law aspect.
// SOR_222 Waylay (Event, cost 3, Cunning) → costs 3+2=5 without a Cunning aspect.
//
// Sabine Wren (SOR_014) has Command+Aggression — no Law or Cunning.
// P2 needs 3 resources for Confiscate and 5 for Waylay with that leader.

// ---------------------------------------------------------------------------
// Luke Skywalker — When Defeated as Upgrade
// ---------------------------------------------------------------------------

describe("Luke Skywalker JTL_094 — When Defeated as Upgrade", () => {
  it("Confiscated: Luke ejects to P1 ground arena exhausted", async () => {
    // Setup: P1 has MF (space) with Luke as pilot. P2 plays Confiscate targeting Luke.
    // Law aspect is not covered by standard bases → cost 1+2=3 for P2.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .WithActivePlayer(2)
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        ])
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.confiscate)
        .Build(),
    );

    // P2 plays Confiscate → ability-target for upgrades
    await g.playCardFromHandAsync(2, 0);
    // Target Luke's upgrade on P1's MF
    await g.chooseUpgradeOnSpaceUnitAsync(2, 1, 0, 0);

    // Luke eject option fires — P1 chooses to move Luke to ground
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    await g.chooseOptionAsync(1, "move_to_ground_exhausted=JTL_094,1");

    // MF should have no more upgrades; Luke is in P1's ground arena (exhausted)
    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    const luke = g.state.player1.groundArena[0];
    expect(luke.cardId).toBe(Cards.units.jtl.lukeSkywalker);
    expect(luke.ready).toBe(false); // exhausted
    expect(luke.damage).toBe(0);
  });

  it("Vehicle defeated in combat: Luke ejects to P1 ground arena exhausted", async () => {
    // P1 has MF (space, 4 HP) pre-damaged to 3 so any hit finishes it.
    // P2 has TIE Fighter token (1/1, space) to deal the killing blow.
    // After MF dies, Luke's eject fires.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .WithActivePlayer(2)
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon, true, 5) // 5 damage → 1 HP left (MF has 6 total HP with Luke pilot: 4 base + 2 from Luke upgrade)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        ])
        .WithSpaceUnitForPlayer(2, Cards.units.token.tieFighter) // 1 power kills MF
        .Build(),
    );

    // P2's TIE Fighter attacks P1's MF
    await g.attackWithSpaceUnitAsync(2, 0);
    const mfPlayId = g.state.player1.spaceArena[0].playId;
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [mfPlayId] });

    // Luke eject option fires — P1 chooses to move Luke to ground
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    await g.chooseOptionAsync(1, "move_to_ground_exhausted=JTL_094,1");

    // MF is defeated (gone from space arena), TIE Fighter also dies
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
    // Luke is now in P1's ground arena, exhausted
    expect(g.state.player1.groundArena).toHaveLength(1);
    const luke = g.state.player1.groundArena[0];
    expect(luke.cardId).toBe(Cards.units.jtl.lukeSkywalker);
    expect(luke.ready).toBe(false);
    expect(luke.damage).toBe(0);
  });

  it("Vehicle bounced via Waylay: Luke ejects to P1 ground arena exhausted", async () => {
    // P1 has MF (space) with Luke as pilot.
    // P2 plays Waylay targeting MF. MF returns to P1's hand. Luke ejects.
    // Cunning not covered by Sabine → cost 3+2=5 for P2.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .WithActivePlayer(2)
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        ])
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 5)
        .WithCardInHandForPlayer(2, Cards.events.sor.waylay)
        .Build(),
    );

    // P2 plays Waylay → ability-target for non-leader units
    await g.playCardFromHandAsync(2, 0);
    // Target P1's MF (in space arena)
    const mfPlayId = g.state.player1.spaceArena[0].playId;
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [mfPlayId] });

    // Luke eject option fires — P1 moves Luke to ground
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    await g.chooseOptionAsync(1, "move_to_ground_exhausted=JTL_094,1");

    // MF is back in P1's hand; P1 space arena empty
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.hand[0].cardId).toBe(Cards.units.jtl.millenniumFalcon);
    // Luke is in P1's ground arena, exhausted, 0 damage
    expect(g.state.player1.groundArena).toHaveLength(1);
    const luke = g.state.player1.groundArena[0];
    expect(luke.cardId).toBe(Cards.units.jtl.lukeSkywalker);
    expect(luke.ready).toBe(false);
    expect(luke.damage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// L3-37 — Replacement Effect
// ---------------------------------------------------------------------------

describe("L3-37 JTL_049 — Replacement Effect When Defeated", () => {
  // Base setup: P1 has L3-37 (ground, 3/3), P2 has Battlefield Marine (ground, 3/3).
  // P1 is active. P1 attacks P2's Marine with L3-37 — both deal 3 damage, both die.
  // When L3-37 would be defeated, her replacement effect is checked.

  it("empty ship: L3-37 attaches to Millennium Falcon instead of being defeated", async () => {
    // P1 has L3-37 (ground) + MF (space, no pilots). MF has no pilots → eligible.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.l337)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    // P1 attacks P2's Marine with L3-37 — both die (3 power each, 3 HP each)
    await g.attackWithGroundUnitAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // L3-37 replacement prompt fires
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    expect((res as { helperText?: string }).helperText).toContain("L3-37");

    // P1 says Yes
    await g.chooseYesAsync(1);

    // Now choose the Millennium Falcon as the target vehicle
    const mfPlayId = g.state.player1.spaceArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [mfPlayId] });

    // L3-37 is now an upgrade on the Falcon, not in the discard
    expect(g.state.player1.groundArena).toHaveLength(0); // L3-37 not a unit anymore
    expect(g.state.player1.discard).toHaveLength(0);     // not defeated
    expect(g.state.player2.groundArena).toHaveLength(0); // Marine died
    expect(g.state.player1.spaceArena).toHaveLength(1);
    const mf = g.state.player1.spaceArena[0];
    expect(mf.upgrades).toHaveLength(1);
    expect(mf.upgrades[0].cardId).toBe(Cards.units.jtl.l337);
  });

  it("ship with a regular pilot: L3-37 is defeated normally (no replacement offered)", async () => {
    // MF has Luke (JTL_094) as pilot → has a pilot → L3-37 cannot attach.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.l337)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // No replacement offered: L3-37 goes to discard (state response, not Option)
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.jtl.l337)).toBe(true);
    // Marine also defeated
    expect(g.state.player2.groundArena).toHaveLength(0);
    // MF still in space arena with Luke upgrade (Luke's eject also fires since MF was not defeated)
    // Actually MF was not involved in combat — it's still in space arena.
    expect(g.state.player1.spaceArena).toHaveLength(1);
    // Luke was NOT defeated as upgrade (MF survived), so no eject prompt.
  });

  it("ship with R2-D2 only: L3-37 is defeated normally (R2-D2 counts as a pilot)", async () => {
    // MF has R2-D2 (JTL_245, PilotingCost=0) as pilot → counts as a pilot → L3-37 cannot attach.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren, false)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.l337)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.r2d2, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const marinePlayId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // No replacement offered: L3-37 goes to discard
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.jtl.l337)).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(0);
    // MF still in space with R2-D2
    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(1);
    expect(g.state.player1.spaceArena[0].upgrades[0].cardId).toBe(Cards.units.jtl.r2d2);
  });
});
