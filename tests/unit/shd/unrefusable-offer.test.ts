import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_226 Unrefusable Offer — cost 2 Cunning upgrade (Bounty, Condition).
// Errata (2025-03-05): "Attach to a non-leader unit. Attached unit gains: 'Bounty — Play this unit
// from its owner's discard pile or from capture for free (under your control). It enters play
// ready. At the start of the regroup phase, defeat it.'"
//
// Player 1 is the bounty collector throughout: the upgrade goes on a Player 2 unit, and the
// bounty is collected by the defeated unit's opponent.

/** P1 holds Vanquish and the upgrade is already attached to P2's `victimCardId`. */
function attachedState(victimCardId: string, opts: { activePlayer?: 1 | 2 } = {}) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
    .WithGroundUnitForPlayer(2, victimCardId)
    .WithUpgradesOnGroundUnitForPlayer(2, 0, [
      GameStateBuilder.Upgrade(Cards.upgrades.shd.unrefusableOffer, 1),
    ])
    .WithActivePlayer(opts.activePlayer ?? 1);
}

/** P1 plays Vanquish on P2's first ground unit. */
async function vanquishTheVictim(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseGroundUnitAsync(2, 0);
}

describe("SHD_226 Unrefusable Offer", () => {
  // -------------------------------------------------------------------------
  // Scenario 1 — vanilla unit: collect, enters ready under the collector,
  // defeated at the start of regroup (Sneak Attack style).
  // -------------------------------------------------------------------------

  it("replays the defeated unit under the collector's control, ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.battlefieldMarine).Build());

    await vanquishTheVictim(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // collect the bounty?
    await g.chooseYesAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(0);
    const stolen = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(stolen).toBeDefined();
    expect(stolen!.ready).toBe(true); // "It enters play ready"
    expect(stolen!.controller).toBe(1);
    expect(stolen!.owner).toBe(2); // played from ITS OWNER's discard — ownership never changes
  });

  it("is free — the collector pays nothing for it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.battlefieldMarine).Build());

    await vanquishTheVictim(g);
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseYesAsync(1);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore);
  });

  it("declining the bounty leaves the card in its owner's discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.battlefieldMarine).Build());

    await vanquishTheVictim(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("defeats the stolen unit at the start of the regroup phase, into its OWNER's discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.battlefieldMarine).Build());

    await vanquishTheVictim(g);
    await g.chooseYesAsync(1);
    expect(g.state.player1.groundArena).toHaveLength(1);

    // Both players pass — the action phase ends and regroup begins.
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player1.discard.map(d => d.cardId)).not.toContain(Cards.units.sor.battlefieldMarine);
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — on Superlaser Technician, defeated by the COLLECTOR's Vanquish.
  // The collector is the active player, so the bounty resolves first: they take
  // the card, and SLT's When Defeated can no longer resolve.
  // -------------------------------------------------------------------------

  it("collector's own removal resolves the bounty before the victim's When Defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.superlaserTechnician).Build());

    await vanquishTheVictim(g);
    await g.chooseYesAsync(1); // the bounty is offered first

    const stolen = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.superlaserTechnician);
    expect(stolen).toBeDefined();
    expect(stolen!.controller).toBe(1);
  });

  it("SLT's When Defeated no longer resolves once the bounty took the card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.superlaserTechnician).Build());
    const resourcesBefore = g.state.player2.resources.length;

    await vanquishTheVictim(g);
    await g.chooseYesAsync(1);

    // No dead prompt is left over for player 2 …
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    // … and no resource is conjured from a card that is now in play under player 1.
    expect(g.state.player2.resources).toHaveLength(resourcesBefore);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.sor.superlaserTechnician)).toBe(false);
  });

  it("control: declining the bounty lets SLT's owner resolve its When Defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.sor.superlaserTechnician).Build());
    const resourcesBefore = g.state.player2.resources.length;

    await vanquishTheVictim(g);
    await g.chooseNoAsync(1); // decline the bounty — SLT's own trigger follows
    await g.chooseYesAsync(2);

    expect(g.state.player2.resources).toHaveLength(resourcesBefore + 1);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.sor.superlaserTechnician)).toBe(true);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — SLT's own controller kills it by attacking. They are the active
  // player, so their When Defeated resolves first: SLT becomes a resource (a zone
  // hidden from the opponent) and the bounty can no longer find it.
  // -------------------------------------------------------------------------

  it("victim's controller acting first: their When Defeated resolves before the bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attachedState(Cards.units.sor.superlaserTechnician, { activePlayer: 2 })
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 — kills the 2/1 SLT
        .Build(),
    );
    const resourcesBefore = g.state.player2.resources.length;

    await g.attackWithGroundUnitAsync(2, 0); // SLT attacks into the Marine and dies
    await g.chooseGroundUnitAsync(1, 0);

    // Player 2's own trigger comes first.
    await g.chooseYesAsync(2);
    expect(g.state.player2.resources).toHaveLength(resourcesBefore + 1);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.sor.superlaserTechnician)).toBe(true);
  });

  it("the bounty then finds nothing — a resource is a hidden zone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attachedState(Cards.units.sor.superlaserTechnician, { activePlayer: 2 })
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseYesAsync(2); // SLT resourced itself

    // The bounty is still offered, but there is no longer a card it can reach.
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") {
      await g.chooseYesAsync(1);
    }
    expect(g.state.player1.groundArena).toHaveLength(1); // only the Marine
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.superlaserTechnician)).toBe(false);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.sor.superlaserTechnician)).toBe(true);
  });

  it("control: if SLT's controller DECLINES their trigger, the bounty can still take it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attachedState(Cards.units.sor.superlaserTechnician, { activePlayer: 2 })
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseNoAsync(2); // SLT stays in the discard
    await g.chooseYesAsync(1); // now the bounty finds it

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.superlaserTechnician)).toBe(true);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.sor.superlaserTechnician)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Remaining clauses and edges
  // -------------------------------------------------------------------------

  it("the replayed unit's When Played ability fires — it is played, not returned", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attachedState(Cards.units.twi.battleDroidEscort).Build()); // WP: create a Battle Droid

    await vanquishTheVictim(g);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(Cards.units.twi.battleDroidEscort);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.token.battleDroid)).toBe(true);
  });

  it("can be played out of the capture zone, not just the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attachedState(Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // the captor
        .Build(),
    );

    await g.playCardFromHandAsync(1, 1); // Take Captive
    await g.chooseGroundUnitAsync(1, 0); // captor
    await g.chooseGroundUnitAsync(2, 0); // victim (carrying the bounty)

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.groundArena[0].captives).toHaveLength(0); // no longer captive
  });

  it("a defeated TOKEN unit leaves nothing to replay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.shd.unrefusableOffer, 1),
        ])
        .WithActivePlayer(1)
        .Build(),
    );

    await vanquishTheVictim(g);
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") {
      await g.chooseYesAsync(1);
    }

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("cannot be attached to a leader unit ('attach to a non-leader unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.upgrades.shd.unrefusableOffer)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // a leader unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const leaderPlayId = g.state.player2.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("a second bounty on the same unit still resolves after this one replays the card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attachedState(Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.shd.unrefusableOffer, 1),
          GameStateBuilder.Upgrade(Cards.upgrades.shd.publicEnemy, 1), // Bounty: give a Shield token
        ])
        .Build(),
    );

    await vanquishTheVictim(g);
    await g.chooseYesAsync(1); // Unrefusable Offer — replays the Marine under P1

    // Public Enemy's bounty is keyed to the same unit but is a separate trigger — it survives.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // shield the stolen Marine

    const stolen = g.state.player1.groundArena[0];
    expect(stolen.cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(stolen.upgrades.map(u => u.cardId)).toContain(Cards.upgrades.token.shield);
  });

  it("attaches to a non-leader unit and grants it Bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.upgrades.shd.unrefusableOffer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].upgrades.map(u => u.cardId))
      .toContain(Cards.upgrades.shd.unrefusableOffer);
  });
});
