import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";

// LAW_019 Alliance Outpost (Base, 26 HP, Vigilance)
// "Epic Action [defeat a friendly token]: Give an Experience or Shield token to a unit,
//  or create a Credit token."

function xpToken(): CardInPlay[] {
  return [{ cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 }];
}

function tokensOn(unit: { upgrades: { cardId: string }[] }, cardId: string) {
  return unit.upgrades.filter(u => u.cardId === cardId);
}

/** Base setup: Alliance Outpost + a friendly Battle Droid TOKEN unit to pay the cost with. */
function setup(extra: (b: GameStateBuilder) => GameStateBuilder = b => b) {
  return extra(
    new GameStateBuilder()
      .MyBase(Cards.bases.law.allianceOutpost)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // the friendly token (cost)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine), // a unit to receive tokens
  ).Build();
}

describe("LAW_019 Alliance Outpost — Epic Action", () => {
  it("defeats a friendly token unit as the cost, then gives an Experience token to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // pay: defeat the Battle Droid token
    await g.chooseOptionAsync(1, "experience");
    await g.chooseGroundUnitAsync(1, 0); // the Marine (the droid is gone, so it is index 0)

    expect(g.state.player1.groundArena).toHaveLength(1); // the token was defeated
    expect(tokensOn(g.state.player1.groundArena[0], Cards.upgrades.token.experience)).toHaveLength(1);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("can give a Shield token instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "shield");
    await g.chooseGroundUnitAsync(1, 0);

    expect(tokensOn(g.state.player1.groundArena[0], Cards.upgrades.token.shield)).toHaveLength(1);
  });

  it("can create a Credit token instead (no unit target)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "credit");

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    expect(g.state.player1.groundArena).toHaveLength(1); // token unit defeated
  });

  it("a token UPGRADE can also pay the cost", async () => {
    const g = new GameTestAdapter();
    // No token units — but the Marine carries an Experience token, which is a friendly token.
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.law.allianceOutpost)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, xpToken())
      .Build();
    g.loadNewState(s);

    await g.useBaseAbilityAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0); // defeat the Experience token
    await g.chooseOptionAsync(1, "credit");

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    expect(tokensOn(g.state.player1.groundArena[0], Cards.upgrades.token.experience)).toHaveLength(0);
  });

  it("cannot be used with no friendly token to defeat", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.law.allianceOutpost)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // no tokens anywhere
      .Build();
    g.loadNewState(s);

    const used = await g.useBaseAbilityAsync(1);

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.base.epicActionUsed).toBe(false);
  });
});
