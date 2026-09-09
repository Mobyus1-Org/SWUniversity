import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   TWI_153 Bold Resistance       — "Choose up to 3 units that share the same Trait. Each gets
//                                    +2/+0 for this phase."
//   TWI_156 Unlimited Power       — "Deal 4 damage to a unit, 3 to a second, 2 to a third, and 1
//                                    to a fourth. (All simultaneous.)"
//   TWI_176 Caught in the Crossfire — "Choose 2 ENEMY units in the same arena. Each deals damage
//                                    equal to its power to the other."

const BOLD = Cards.events.twi.boldResistance;
const UNLIMITED = Cards.events.twi.unlimitedPower;
const CROSSFIRE = Cards.events.twi.caughtInTheCrossfire;
const DROID = Cards.units.token.battleDroid;            // 1/1, Droid/Trooper/Separatist
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3 Ground
const FRIGATE = "JTL_069";                              // 4/7 Space

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const all = (g: GameTestAdapter, p: 1 | 2) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena];
};
const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};

describe("TWI_153 Bold Resistance", () => {
  it("gives +2/+0 to up to 3 units sharing a Trait, HP untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, BOLD)
        .WithGroundUnitForPlayer(1, DROID)
        .WithGroundUnitForPlayer(1, DROID)
        .WithGroundUnitForPlayer(1, DROID)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: all(g, 1).filter(u => u.cardId === DROID).map(u => u.playId),
    });

    for (const raw of all(g, 1).filter(u => u.cardId === DROID)) {
      const u = Unit.FromInterface(raw);
      expect(u.CurrentPower()).toBe(3);
      expect(u.TotalHP()).toBe(1);
    }
  });

  it("rejects a selection whose units do not share a Trait", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, BOLD)
        .WithGroundUnitForPlayer(1, DROID)     // Droid/Trooper/Separatist
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa) // Creature
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const res = await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: all(g, 1).map(u => u.playId),
    });

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("accepts fewer than 3 — it says UP TO", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, BOLD).WithGroundUnitForPlayer(1, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [all(g, 1)[0].playId] });

    expect(Unit.FromInterface(all(g, 1)[0]).CurrentPower()).toBe(5);
  });
});

describe("TWI_156 Unlimited Power", () => {
  it("deals 4/3/2/1 in pick order", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, UNLIMITED)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    const ids = all(g, 2).map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    for (const id of ids) {
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [id] });
    }

    expect(all(g, 2).map(u => u.damage)).toEqual([4, 3, 2, 1]);
  });

  it("fizzles the leftover amounts when fewer units are in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, UNLIMITED)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    const ids = all(g, 2).map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    for (const id of ids) {
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [id] });
    }

    expect(all(g, 2).map(u => u.damage)).toEqual([4, 3]);
  });

  it("never offers the same unit twice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, UNLIMITED)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const first = all(g, 2)[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [first] });

    expect(offered(g)).not.toContain(first);
  });
});

describe("TWI_176 Caught in the Crossfire", () => {
  it("makes the two chosen enemy units trade their power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CROSSFIRE)
        .WithGroundUnitForPlayer(2, SECURITY) // 3/7
        .WithGroundUnitForPlayer(2, MARINE)   // 3/3
        .Build(),
    );
    const security = all(g, 2).find(u => u.cardId === SECURITY)!.playId;
    const marine = all(g, 2).find(u => u.cardId === MARINE)!.playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [security] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(all(g, 2).find(u => u.cardId === SECURITY)!.damage).toBe(3);
    expect(all(g, 2).some(u => u.cardId === MARINE)).toBe(false); // 3 kills the 3/3
  });

  it("uses CURRENT power, so an upgrade on one changes the trade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CROSSFIRE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 2)])
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    const ids = all(g, 2).map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [ids[0]] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [ids[1]] });

    // The upgraded one is 5 power and deals 5; the plain one deals 3.
    expect(all(g, 2).find(u => u.playId === ids[0])!.damage).toBe(3);
    expect(all(g, 2).find(u => u.playId === ids[1])!.damage).toBe(5);
  });

  it("offers only ENEMY units, and only ones sharing the first pick's arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CROSSFIRE)
        .WithGroundUnitForPlayer(1, SECURITY)  // friendly — never offered
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(2, FRIGATE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(offered(g)).not.toContain(all(g, 1)[0].playId);

    const enemyGround = all(g, 2).find(u => u.cardId === SECURITY)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyGround] });

    expect(offered(g)).not.toContain(all(g, 2).find(u => u.cardId === FRIGATE)!.playId);
    expect(offered(g)).toContain(all(g, 2).find(u => u.cardId === MARINE)!.playId);
  });

  it("does nothing with fewer than 2 enemy units in any one arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CROSSFIRE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(2, FRIGATE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(all(g, 2).every(u => u.damage === 0)).toBe(true);
  });
});
