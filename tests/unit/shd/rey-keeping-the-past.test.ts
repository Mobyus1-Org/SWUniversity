import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_046 Rey — Keeping the Past (Unit 4/7 Ground, cost 5, Heroism/Vigilance)
//   "While playing this unit, ignore her Heroism aspect penalty if you control Kylo Ren.
//    On Attack: You may heal 2 damage from a unit. If it's a non-Heroism unit, give a Shield
//    token to it."
//
// The waiver drops only the HEROISM icon — an uncovered Vigilance icon still costs 2.

const REY = Cards.units.shd.reyKeepingThePast;
const KYLO_UNIT = Cards.units.shd.kyloRenKillingThePast;
const HEROIC = Cards.units.sor.consularSecurityForce; // 3/7, Vigilance/Heroism
const NON_HEROIC = Cards.units.sor.wampa;              // 4/5, Aggression
const MARINE = Cards.units.sor.battlefieldMarine;
const SHIELD = Cards.upgrades.token.shield;

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SHD_046 Rey — aspect penalty waiver", () => {
  function playSetup(leader: string, baseId: string) {
    return new GameStateBuilder()
      .MyBase(baseId)
      .MyLeader(leader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, MARINE, 14)
      .WithCardInHandForPlayer(1, REY);
  }

  async function costToPlay(g: GameTestAdapter) {
    const before = readyResources(g);
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena.some(u => u.cardId === REY)).toBe(true);
    return before - readyResources(g);
  }

  it("with Kylo Ren as your (undeployed) leader, her Heroism penalty is ignored", async () => {
    const g = new GameTestAdapter();
    // Villainy/Aggression leader + Vigilance base: only Heroism is uncovered.
    g.loadNewState(playSetup(Cards.leaders.shd.kyloRen, Cards.bases.common.blue30HP).Build());
    expect(await costToPlay(g)).toBe(5);
  });

  it("control: without Kylo Ren, the Heroism penalty applies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(playSetup(Cards.leaders.sor.darthVader, Cards.bases.common.blue30HP).Build());
    expect(await costToPlay(g)).toBe(7);
  });

  it("a Kylo Ren UNIT in play counts too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      playSetup(Cards.leaders.sor.darthVader, Cards.bases.common.blue30HP)
        .WithGroundUnitForPlayer(1, KYLO_UNIT)
        .Build(),
    );
    expect(await costToPlay(g)).toBe(5);
  });

  it("an ENEMY Kylo Ren doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      playSetup(Cards.leaders.sor.darthVader, Cards.bases.common.blue30HP)
        .WithGroundUnitForPlayer(2, KYLO_UNIT)
        .Build(),
    );
    expect(await costToPlay(g)).toBe(7);
  });

  it("only Heroism is waived — an uncovered Vigilance icon still costs 2", async () => {
    const g = new GameTestAdapter();
    // Kylo leader + Aggression base: Heroism AND Vigilance uncovered; only Heroism is ignored.
    g.loadNewState(playSetup(Cards.leaders.shd.kyloRen, Cards.bases.common.red30HP).Build());
    expect(await costToPlay(g)).toBe(7);
  });
});

describe("SHD_046 Rey — On Attack", () => {
  function attackSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithGroundUnitForPlayer(1, REY)
      .WithGroundUnitForPlayer(1, HEROIC, true, 3)
      .WithGroundUnitForPlayer(1, NON_HEROIC, true, 3);
  }

  const shields = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === SHIELD).length;

  it("heals 2 from a Heroism unit — no Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.state.player1.groundArena[1].damage).toBe(1);
    expect(shields(g.state.player1.groundArena[1])).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("heals 2 from a non-Heroism unit AND gives it a Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 2);

    expect(g.state.player1.groundArena[2].damage).toBe(1);
    expect(shields(g.state.player1.groundArena[2])).toBe(1);
  });

  it("any unit may be chosen — even an undamaged enemy, which still gets the Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().WithGroundUnitForPlayer(2, NON_HEROIC).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId); // Rey herself
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);

    await g.chooseGroundUnitAsync(2, 0);
    expect(shields(g.state.player2.groundArena[0])).toBe(1);
  });

  it("declining heals nothing and gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[1].damage).toBe(3);
    expect(g.state.player1.groundArena[2].damage).toBe(3);
    expect(shields(g.state.player1.groundArena[2])).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });
});
