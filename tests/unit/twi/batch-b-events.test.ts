import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   SHD_159 The Chaos of War  — "Deal damage to each player's base equal to the number of cards in
//                               that player's hand."
//   SHD_233 Evacuate          — "Return each non-leader unit to its owner's hand."
//   TWI_041 Lethal Crackdown  — "Defeat a non-leader unit. Deal damage to YOUR base equal to that
//                               unit's power."

const CHAOS = Cards.events.shd.theChaosOfWar;
const EVACUATE = Cards.events.shd.evacuate;
const CRACKDOWN = Cards.events.twi.lethalCrackdown;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const WAMPA = Cards.units.sor.wampa;                    // 4/5
const XWING = Cards.units.sor.wingLeader;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};
const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};

describe("SHD_159 The Chaos of War", () => {
  it("meters each base by ITS OWN controller's hand, counted after the event leaves hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CHAOS)
        .WithCardInHandForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, MARINE) // 2 left once Chaos is played
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, MARINE) // 3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("deals nothing to an empty hand, and never touches units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, CHAOS).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
    expect(find(g, 2, SECURITY)!.damage).toBe(0);
  });
});

describe("SHD_233 Evacuate", () => {
  it("returns every non-leader unit on both sides to its owner's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, EVACUATE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.some(c => c.cardId === MARINE)).toBe(true);
    expect(g.state.player1.hand.some(c => c.cardId === XWING)).toBe(true);
    expect(g.state.player2.hand.some(c => c.cardId === SECURITY)).toBe(true);
  });

  it("leaves deployed LEADERS in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, EVACUATE)
        .WithGroundUnitForPlayer(1, MARINE)
        .FillResourcesForPlayer(2, MARINE, 20)
        .Build(),
    );
    g.state.activePlayer = 2;
    await g.deployLeaderAsync(2);
    await g.dispatchAsync(2, "pass-action", {});
    expect(g.state.player2.groundArena).toHaveLength(1);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena).toHaveLength(1); // the leader stays
    expect(g.state.player1.groundArena).toHaveLength(0);
  });
});

describe("TWI_041 Lethal Crackdown", () => {
  it("defeats the chosen unit and damages YOUR base by its power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, CRACKDOWN).WithGroundUnitForPlayer(2, WAMPA).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, WAMPA)!.playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(4); // the caster's base, not the victim's
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("measures CURRENT power, not printed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CRACKDOWN)
        .WithGroundUnitForPlayer(2, WAMPA)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, WAMPA)!.playId] });

    expect(g.state.player1.base.damage).toBe(6); // 4 + 2 from Academy Training
  });

  it("does not offer a deployed LEADER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CRACKDOWN)
        .WithGroundUnitForPlayer(2, WAMPA)
        .FillResourcesForPlayer(2, MARINE, 20)
        .Build(),
    );
    g.state.activePlayer = 2;
    await g.deployLeaderAsync(2);
    await g.dispatchAsync(2, "pass-action", {});
    const leaderUnit = g.state.player2.groundArena.find(u => u.cardId !== WAMPA)!;

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).not.toContain(leaderUnit.playId);
    expect(offered(g)).toContain(find(g, 2, WAMPA)!.playId);
  });

  it("can be aimed at your own unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, CRACKDOWN).WithGroundUnitForPlayer(1, MARINE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(3);
  });
});
