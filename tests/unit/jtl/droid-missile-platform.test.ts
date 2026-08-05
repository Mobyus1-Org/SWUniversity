import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_162 Droid Missile Platform (4/2 Space, cost 3, Separatist/Droid/Vehicle/Transport) —
//   "When Defeated: Deal 3 indirect damage to a player."
//
// The first indirect card that fires MID-RESOLUTION. Its When Defeated goes off during combat with
// the attack still unresolved, so the pending chain has to carry the rest of the attack through the
// choose-a-player step — which is why choose-indirect-target gained a continuation.
describe("JTL_162 Droid Missile Platform", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
  }

  it("When Defeated: offers the player choice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.droidMissilePlatform)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // Vanquish my own platform

    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    expect(res?.type === "Option" && res.options).toContain("Opponent");
    expect(res?.type === "Option" && res.options).toContain("Yourself");
  });

  it("deals 3 to the chosen player, assigned by them", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.droidMissilePlatform)
      .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
      .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [
        { playId: "player2.base", damage: 1 },
        { playId: s.player2.groundArena[0].playId, damage: 2 },
      ],
    });

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("with the opponent holding no units, it all hits their base and never prompts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.droidMissilePlatform)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("dying in COMBAT still resolves the attack afterwards — the continuation is not dropped", async () => {
    // The regression this whole foundation exists for. The platform (4/2) attacks a 4/10 and dies
    // to the counter; its When Defeated interrupts with a player choice, and the attack must still
    // finish (the defender keeps the 4 damage) rather than the board locking up.
    const g = new GameTestAdapter();
    const s = base()
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.droidMissilePlatform)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 — kills it back
      .Build();
    g.loadNewState(s);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 3 }],
    });

    expect(g.state.player1.spaceArena).toHaveLength(0);   // the platform died
    expect(g.state.player2.spaceArena[0].damage).toBe(4); // combat damage still landed
    expect(g.state.player2.base.damage).toBe(3);          // and the bomb went off
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // nothing stranded
  });

  it("may be aimed at yourself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.droidMissilePlatform)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yourself" });

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("control: an ordinary unit dying deals no indirect damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
