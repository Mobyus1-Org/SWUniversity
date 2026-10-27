import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { NeedsTarget } from "@/lib/engine/message-types";

// HMW_015 Bossk — Cruel Hunter (Leader, Cunning/Villainy, Underworld/Bounty Hunter; unit 4/5 Ground)
// Front:    Action [Exhaust]: Heal 1 damage from a damaged enemy unit and give a Weakness token to
//           it.
//           Epic Action: If you control 5 or more resources, deploy this leader.
// Deployed: On Attack: You may deal 2 damage to a unit with a token upgrade on it. (Shield and
//           Weakness tokens are token upgrades.)
//
// The heal comes FIRST, so the Weakness can never kill on its own: a 3/3 with 2 damage is healed
// to 1 damage, then shrinks to 2 HP — alive. Weakness first would have killed it (2 HP, 2 damage).
// The Exhaust is the only cost, so with no damaged enemy the Action is still usable and does
// nothing.
const BOSSK = Cards.leaders.hmw.bossk;
const MARINE = Cards.units.sor.battlefieldMarine;         // 3/3
const CSF = Cards.units.sor.consularSecurityForce;        // 3/7 — survives 2 damage
const WEAKNESS = Cards.units.token.weakness;
const SHIELD = Cards.upgrades.token.shield;
const EXPERIENCE = Cards.upgrades.token.experience;
const NON_TOKEN = Cards.upgrades.sor.protector;
const up = (cardId: string, owner: 1 | 2) => [GameStateBuilder.Upgrade(cardId, owner)];

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(BOSSK)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

/** Bossk already deployed, as a unit in P1's ground arena (index 0). */
function deployedSetup() {
  return setup().MyLeader(BOSSK, true, true, true).WithGroundUnitForPlayer(1, BOSSK);
}

const useBossk = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: BOSSK });
const offered = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as NeedsTarget | undefined)?.fromPlayIds;

describe("HMW_015 Bossk — front Action", () => {
  it("offers only damaged ENEMY units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE, true, 1) // damaged, but friendly
        .WithGroundUnitForPlayer(2, MARINE, true, 1) // damaged enemy
        .WithGroundUnitForPlayer(2, CSF)             // undamaged enemy
        .Build(),
    );

    await useBossk(g);

    expect(offered(g)).toEqual([g.state.player2.groundArena[0].playId]);
  });

  it("heals 1 first, then gives a Weakness token — a 3/3 with 2 damage survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, true, 2).Build());

    await useBossk(g);
    await g.chooseGroundUnitAsync(2, 0);

    const marine = g.state.player2.groundArena[0];
    expect(marine).toBeDefined();
    expect(marine.damage).toBe(1);
    expect(marine.upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
    expect(Unit.FromInterface(marine).TotalHP()).toBe(2);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust is the cost
  });

  it("with no damaged enemy unit it is still usable — it exhausts and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await useBossk(g);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("Epic Action: deploys with 5 resources, not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(setup(5).Build());
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(setup(4).Build());
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_015 Bossk — deployed On Attack", () => {
  /** A board with every kind of upgrade state. Bossk himself carries an Experience token. */
  function board() {
    return deployedSetup()
      .WithUpgradesOnGroundUnitForPlayer(1, 0, up(EXPERIENCE, 1))   // Bossk — token
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, up(EXPERIENCE, 1))   // friendly — token
      .WithGroundUnitForPlayer(2, CSF)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, up(WEAKNESS, 1))     // enemy — Weakness
      .WithGroundUnitForPlayer(2, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(2, 1, up(SHIELD, 2))       // enemy — Shield
      .WithGroundUnitForPlayer(2, CSF)
      .WithUpgradesOnGroundUnitForPlayer(2, 2, up(NON_TOKEN, 2))    // enemy — non-token upgrade
      .WithGroundUnitForPlayer(2, MARINE);                          // enemy — bare
  }

  it("offers exactly the units with a token upgrade, either side, Bossk included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const p1 = g.state.player1.groundArena;
    const p2 = g.state.player2.groundArena;
    expect(offered(g)?.slice().sort()).toEqual(
      [p1[0].playId, p1[1].playId, p2[0].playId, p2[1].playId].sort(),
    );
  });

  it("accepting deals 2 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // the CSF with Weakness

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(5); // Bossk 4 + Experience 1
  });

  it("can hit a friendly unit carrying a token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1); // friendly Marine with Experience (4/4)

    expect(g.state.player1.groundArena[1].damage).toBe(2);
  });

  it("declining deals nothing and the attack still hits", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect([...g.state.player1.groundArena, ...g.state.player2.groundArena].every(u => u.damage === 0)).toBe(true);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("is skipped silently when no unit has a token upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedSetup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, up(NON_TOKEN, 2))
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(4);
  });
});
