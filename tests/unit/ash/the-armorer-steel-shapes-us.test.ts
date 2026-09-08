import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_001 The Armorer — Steel Shapes Us (Leader; deployed 4/6 Ground, Mandalorian)
//   Leader:   "Action [Exhaust]: Play an upgrade from your resources on a unit that entered play
//              this phase (paying its cost). If you do, resource the top card of your deck."
//             "Epic Action: If you control 5 or more resources, deploy this leader."
//   Deployed: "When Attack Ends: You may play an upgrade from your resources on a friendly unit.
//              If you do, resource the top card of your deck."
//
// The new mechanic is playing a card out of the RESOURCE zone — no card did that before. It also
// unblocks SHD_109 Endless Legions, which plays units from resources.
//
// Three restrictions that are easy to lose:
//   - the SOURCE is resources only, never hand or discard;
//   - the leader side's attach target must have ENTERED PLAY THIS PHASE, and may belong to either
//     player — the text says "a unit", not "a friendly unit";
//   - a FORTIFY upgrade is never legal: it attaches to a base, and this attaches to a unit.
//
// The resource spent on the upgrade cannot pay for itself, so it leaves the resource row before
// the cost is charged.

const ARMORER = "ASH_001";
const UPGRADE = "SOR_166";                          // Infiltrator's Skill, cost 1, non-unique
const FORTIFY_UP = "HMW_081";                       // Alliance Shield Generator — Fortify
const MARINE = Cards.units.sor.battlefieldMarine;
const TOP_OF_DECK = Cards.units.sor.wampa;          // distinctive, so it is identifiable in the row

function setup(resources = 8) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(ARMORER)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, MARINE)
    .WithActivePlayer(1);
  for (let i = 0; i < 4; i++) b = b.WithCardInDeckForPlayer(1, MARINE);
  return b;
}

/** Swaps one of player 1's resources for `cardId`, so it can be played from the resource row. */
function resourceIs(g: GameTestAdapter, cardId: string): string {
  const r = g.state.player1.resources[0];
  r.cardId = cardId;
  return r.playId;
}

const useLeaderAction = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: ARMORER });

describe("ASH_001 The Armorer — Steel Shapes Us", () => {
  it("plays an upgrade from resources onto a unit that entered play this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const upgradeId = resourceIs(g, UPGRADE);

    await g.playCardFromHandAsync(1, 0);           // a Marine enters play this phase
    await g.dispatchAsync(2, "pass-action", {});
    await useLeaderAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });
    const host = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [host.playId] });

    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.upgrades.map(u => u.cardId))
      .toEqual([UPGRADE]);
    expect(g.state.player1.resources.some(r => r.playId === upgradeId)).toBe(false);
  });

  it("resources the top card of the deck after doing it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const upgradeId = resourceIs(g, UPGRADE);
    const resourcesBefore = g.state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await useLeaderAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });
    const host = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [host.playId] });

    // One resource left the row to become the upgrade, one arrived from the deck.
    expect(g.state.player1.resources.length).toBe(resourcesBefore);
  });

  it("does not offer a unit that was already in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());
    const upgradeId = resourceIs(g, UPGRADE);
    const oldUnit = g.state.player1.groundArena[0].playId;

    await useLeaderAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(oldUnit);
  });

  it("soft-passes when no unit entered play this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());
    resourceIs(g, UPGRADE);

    await useLeaderAction(g);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("does not offer a FORTIFY upgrade — it attaches to a base, not a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const fortifyId = resourceIs(g, FORTIFY_UP);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await useLeaderAction(g);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(fortifyId);
  });

  it("only RESOURCES are a legal source — an upgrade in hand is not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, UPGRADE).Build());
    resourceIs(g, MARINE); // no upgrade in the resource row at all

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await useLeaderAction(g);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("charges the upgrade's cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const upgradeId = resourceIs(g, UPGRADE);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await useLeaderAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });
    const host = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [host.playId] });

    // The cost-1 upgrade is paid for, and its own resource left the row.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBeLessThan(readyBefore);
  });

  it("exhausts the leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const upgradeId = resourceIs(g, UPGRADE);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await useLeaderAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });

    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("deploys at 5 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
  });

  it("does not deploy at 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });

  describe("the deployed side — When Attack Ends", () => {
    /** Deploys her (Epic Action needs 5+) and hands the turn back. */
    async function deployed(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.Build());
      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      return g;
    }

    it("plays an upgrade from resources onto ANY friendly unit after her attack", async () => {
      // Unlike the leader side, the target need not have entered play this phase.
      const g = await deployed(
        setup().WithGroundUnitForPlayer(1, MARINE).WithCardInDeckForPlayer(1, TOP_OF_DECK),
      );
      const upgradeId = resourceIs(g, UPGRADE);
      const armorerIdx = g.state.player1.groundArena.findIndex(u => u.cardId === ARMORER);
      const deckBefore = g.state.player1.deck.length;

      await g.attackWithGroundUnitAsync(1, armorerIdx);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });
      const host = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [host.playId] });

      expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.upgrades.map(u => u.cardId))
        .toEqual([UPGRADE]);
      // "If you do, resource the top card of your deck." The row loses the upgrade it played and
      // gains the deck's top card, so its size is unchanged and the deck is one shorter.
      expect(g.state.player1.deck.length).toBe(deckBefore - 1);
      expect(g.state.player1.resources.some(r => r.cardId === TOP_OF_DECK)).toBe(true);
    });

    it("allows HERSELF as the attach target", async () => {
      const g = await deployed(setup());
      const upgradeId = resourceIs(g, UPGRADE);
      const armorerIdx = g.state.player1.groundArena.findIndex(u => u.cardId === ARMORER);
      const armorerPlayId = g.state.player1.groundArena[armorerIdx].playId;

      await g.attackWithGroundUnitAsync(1, armorerIdx);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [armorerPlayId] });

      const her = g.state.player1.groundArena.find(u => u.playId === armorerPlayId)!;
      expect(her.upgrades.map(u => u.cardId)).toEqual([UPGRADE]);
    });

    it("does not offer an ENEMY unit — the deployed side says 'a friendly unit'", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(2, MARINE));
      const upgradeId = resourceIs(g, UPGRADE);
      const armorerIdx = g.state.player1.groundArena.findIndex(u => u.cardId === ARMORER);

      await g.attackWithGroundUnitAsync(1, armorerIdx);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradeId] });

      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
      expect(offered).not.toContain(g.state.player2.groundArena[0].playId);
    });

    it("is optional — declining changes nothing", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(1, MARINE));
      resourceIs(g, UPGRADE);
      const armorerIdx = g.state.player1.groundArena.findIndex(u => u.cardId === ARMORER);
      const resourcesBefore = g.state.player1.resources.length;

      await g.attackWithGroundUnitAsync(1, armorerIdx);
      await g.chooseBaseAsync(1, 2);
      await g.chooseNoAsync(1);

      expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.upgrades).toHaveLength(0);
      expect(g.state.player1.resources.length).toBe(resourcesBefore);
    });

    it("asks nothing when the resource row holds no upgrade", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(1, MARINE));
      const armorerIdx = g.state.player1.groundArena.findIndex(u => u.cardId === ARMORER);

      await g.attackWithGroundUnitAsync(1, armorerIdx);
      await g.chooseBaseAsync(1, 2);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });
  });
});
