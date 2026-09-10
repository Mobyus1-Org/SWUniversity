import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// SHD_141 Kylo Ren — Killing the Past (Unit 6/7 Ground, cost 6, Villainy/Aggression)
//   "While playing this unit, ignore his Villainy aspect penalty if you control Rey.
//    On Attack: Give a unit +2/+0 for this phase. If it's a non-Villainy unit, also give an
//    Experience token to it."

const KYLO = Cards.units.shd.kyloRenKillingThePast;
const REY_UNIT = Cards.units.shd.reyKeepingThePast;
const VILLAIN = Cards.units.sor.tieLnFighter;         // 2/1 Space, Villainy
const NON_VILLAIN = Cards.units.sor.battlefieldMarine; // 3/3, Command/Heroism
const XP = Cards.upgrades.token.experience;

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SHD_141 Kylo Ren — aspect penalty waiver", () => {
  function playSetup(leader: string, baseId: string) {
    return new GameStateBuilder()
      .MyBase(baseId)
      .MyLeader(leader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, NON_VILLAIN, 14)
      .WithCardInHandForPlayer(1, KYLO);
  }

  async function costToPlay(g: GameTestAdapter) {
    const before = readyResources(g);
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena.some(u => u.cardId === KYLO)).toBe(true);
    return before - readyResources(g);
  }

  it("with Rey as your (undeployed) leader, his Villainy penalty is ignored", async () => {
    const g = new GameTestAdapter();
    // Heroism/Vigilance leader + Aggression base: only Villainy is uncovered.
    g.loadNewState(playSetup(Cards.leaders.shd.rey, Cards.bases.common.red30HP).Build());
    expect(await costToPlay(g)).toBe(6);
  });

  it("control: without Rey, the Villainy penalty applies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(playSetup(Cards.leaders.sor.leiaOrgana, Cards.bases.common.red30HP).Build());
    expect(await costToPlay(g)).toBe(8);
  });

  it("a Rey UNIT in play counts too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      playSetup(Cards.leaders.sor.leiaOrgana, Cards.bases.common.red30HP)
        .WithGroundUnitForPlayer(1, REY_UNIT)
        .Build(),
    );
    expect(await costToPlay(g)).toBe(6);
  });

  it("only Villainy is waived — an uncovered Aggression icon still costs 2", async () => {
    const g = new GameTestAdapter();
    // Rey leader + Command base: Villainy AND Aggression uncovered; only Villainy is ignored.
    g.loadNewState(playSetup(Cards.leaders.shd.rey, Cards.bases.common.green30HP).Build());
    expect(await costToPlay(g)).toBe(8);
  });
});

describe("SHD_141 Kylo Ren — On Attack", () => {
  function attackSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithGroundUnitForPlayer(1, KYLO)
      .WithGroundUnitForPlayer(1, NON_VILLAIN)
      .WithSpaceUnitForPlayer(1, VILLAIN);
  }

  const power = (u: Parameters<typeof Unit.FromInterface>[0]) => Unit.FromInterface(u).CurrentPower();
  const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

  it("is mandatory — goes straight to a target, no Yes/No", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const res = g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] };
    expect(res.type).toBe("Target");
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId); // himself
  });

  it("a non-Villainy unit gets +2/+0 for the phase AND an Experience token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 1);

    const marine = g.state.player1.groundArena[1];
    expect(xp(marine)).toBe(1);
    expect(power(marine)).toBe(3 + 2 + 1); // base 3, +2 phase, +1 Experience
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("a Villainy unit gets only the +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseSpaceUnitAsync(1, 0);

    const tie = g.state.player1.spaceArena[0];
    expect(xp(tie)).toBe(0);
    expect(power(tie)).toBe(4);
  });

  it("targeting himself (Villainy) buffs this very attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(8);
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });
});
