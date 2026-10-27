import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Fortify upgrades sit on a BASE, not a unit. "Defeat an upgrade" is unqualified, so every card
// with that text may now pick one — and the defeat runs through the base-upgrade chokepoint (owner's
// discard, Zeb's "friendly upgrade defeated" reaction, HMW_060 Rampart's offer). Text narrowed to
// units ("attached to a unit") and non-defeat effects (Criminal Muscle's return) stay units-only.

const MEMORIAL = Cards.upgrades.hmw.sinisterWarMemorial; // cost 2
const TRAP = Cards.upgrades.hmw.trapField;                // cost 2
const XP = Cards.upgrades.token.experience;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;        // 3/7 Ground

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithActivePlayer(1);
}

const prompt = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as
  { type?: string; fromPlayIds?: string[] } | undefined;
const baseUpgradeId = (g: GameTestAdapter, player: 1 | 2) =>
  (player === 1 ? g.state.player1 : g.state.player2).base.upgrades![0].playId;

describe("\"defeat an upgrade\" reaches base upgrades", () => {
  it("SOR_162 Disabling Fang Fighter can defeat an upgrade on a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnBaseForPlayer(2, [up(MEMORIAL, 2)])
        .WithCardInHandForPlayer(1, Cards.units.sor.disablingFangFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    expect(prompt(g)?.fromPlayIds).toContain(baseUpgradeId(g, 2));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [baseUpgradeId(g, 2)] });

    expect(g.state.player2.base.upgrades ?? []).toHaveLength(0);
    expect(g.state.player2.discard.some(c => c.cardId === MEMORIAL)).toBe(true);
  });

  it("SOR_162 Disabling Fang Fighter deals no damage to the unit it strips (that is System Shock's text)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(XP, 2)])
        .WithCardInHandForPlayer(1, Cards.units.sor.disablingFangFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("SEC_163 Outer Rim Constable can defeat an upgrade on its own player's base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1)])
        .WithCardInHandForPlayer(1, Cards.units.sec.outerRimConstable)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [baseUpgradeId(g, 1)] });

    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === MEMORIAL)).toBe(true);
  });

  it("SHD_147 Ketsu Onyo offers a base upgrade costing 2 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, Cards.units.shd.ketsuOnyo)
        .WithUpgradesOnBaseForPlayer(2, [up(MEMORIAL, 2)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(prompt(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(prompt(g)?.fromPlayIds).toContain(baseUpgradeId(g, 2));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [baseUpgradeId(g, 2)] });

    expect(g.state.player2.base.upgrades ?? []).toHaveLength(0);
  });

  it("ASH_161 Zeb reacts to a friendly BASE upgrade being defeated (Trap Field springing)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.zebOrrelios)
        .WithUpgradesOnBaseForPlayer(1, [up(TRAP, 1)])
        .WithCardInHandForPlayer(1, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(1);
  });
});

describe("units-only upgrade effects ignore base upgrades", () => {
  it("JTL_175 System Shock ('attached to a unit') does not offer a base upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(XP, 2)])
        .WithUpgradesOnBaseForPlayer(2, [up(MEMORIAL, 2)])
        .WithCardInHandForPlayer(1, Cards.events.jtl.systemShock)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(prompt(g)?.fromPlayIds).toEqual([g.state.player2.groundArena[0].upgrades[0].playId]);
  });

  it("SHD_209 Criminal Muscle (returns, doesn't defeat) does not offer a base upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.sor.entrenched, 2)])
        .WithUpgradesOnBaseForPlayer(2, [up(MEMORIAL, 2)])
        .WithCardInHandForPlayer(1, Cards.units.shd.criminalMuscle)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(prompt(g)?.fromPlayIds).toEqual([g.state.player2.groundArena[0].upgrades[0].playId]);
  });
});
