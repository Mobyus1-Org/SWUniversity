import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IC27_060 Jabba the Hutt — Bounties Left and Right (0/8 Ground, cost 3, Command/Villainy)
//   "Action [Exhaust]: Choose an enemy unit. For this phase, while that unit is defending, the
//    attacker gets +4/+0."

const JABBA = Cards.units.ic27.jabbaTheHutt;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const TIE = Cards.units.sor.tieLnFighter;
const WAMPA = Cards.units.sor.wampa;                    // 4/5

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, JABBA);
}

async function markEnemy(g: GameTestAdapter, enemyPlayId: string) {
  await g.dispatchAsync(1, "use-ability", { cardId: JABBA, playId: g.state.player1.groundArena[0].playId });
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
  await g.dispatchAsync(2, "pass-action", {});
}

describe("IC27_060 Jabba the Hutt — Bounties Left and Right", () => {
  it("only enemy units are offered, in both arenas, and Jabba exhausts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithSpaceUnitForPlayer(2, TIE)
      .Build());

    await g.dispatchAsync(1, "use-ability", { cardId: JABBA, playId: g.state.player1.groundArena[0].playId });
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? [...(res.fromPlayIds ?? [])].sort() : [];

    expect(offered).toEqual([g.state.player2.groundArena[0].playId, g.state.player2.spaceArena[0].playId].sort());
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("an attacker into the marked unit gets +4/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, SECURITY) // 3/7
      .Build());

    await markEnemy(g, g.state.player2.groundArena[0].playId);
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 3 + 4 = 7 → exactly lethal
  });

  it("the bonus is the attacker's power for the attack: Overwhelm carries the excess to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, WAMPA)          // 4/5 Overwhelm
      .WithGroundUnitForPlayer(2, MARINE)         // 3/3
      .Build());

    await markEnemy(g, g.state.player2.groundArena[0].playId);
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(5); // 8 power − 3 HP
  });

  it("a second attack into the marked unit the same phase is boosted again", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, Cards.units.ic27.obiWanKenobi) // 5/9; his When Played is not in play
      .Build());

    await markEnemy(g, g.state.player2.groundArena[0].playId);
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(7);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1); // the first Marine died to the 5 counter-damage
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("attacking an unmarked enemy unit gets no bonus", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await markEnemy(g, g.state.player2.groundArena[0].playId);
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseGroundUnitAsync(2, 1);

    expect(g.state.player2.groundArena[1].damage).toBe(3);
  });

  it("the marked unit attacking gets no bonus — only while it is DEFENDING", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    // The Action is P1's turn; P2 then attacks with the marked unit.
    await g.dispatchAsync(1, "use-ability", { cardId: JABBA, playId: g.state.player1.groundArena[0].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.state.player1.groundArena[1].damage).toBe(3);
  });

  it("the mark expires when the action phase ends", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: JABBA, playId: g.state.player1.groundArena[0].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.currentEffects.some(e => e.cardId === JABBA)).toBe(true);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.gamePhase).not.toBe("ActionPhase");
    expect(g.state.currentEffects.some(e => e.cardId === JABBA)).toBe(false);
  });

  it("is usable with no enemy unit: it just exhausts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    expect(ActionAbilities(JABBA, 1, g.state.player1.groundArena[0].playId)).toContain(JABBA);
    await g.dispatchAsync(1, "use-ability", { cardId: JABBA, playId: g.state.player1.groundArena[0].playId });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
