import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_134 Heavy Missile Gunship (4/3 SPACE, Separatist/Droid/Vehicle/Transport, cost 4)
//   "Action [Exhaust]: Deal 2 damage to a ground unit."
//
// A space unit reaching into the ground arena — the target restriction is the whole point.

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithSpaceUnitForPlayer(1, Cards.units.lof.heavyMissileGunship);
}

const gunshipPlayId = (g: GameTestAdapter) => g.state.player1.spaceArena[0].playId;

describe("LOF_134 Heavy Missile Gunship — Action", () => {
  it("exhausts and deals 2 damage to the chosen ground unit", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.heavyMissileGunship, playId: gunshipPlayId(g) });
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.spaceArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("can target a FRIENDLY ground unit — 'a ground unit', either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.heavyMissileGunship, playId: gunshipPlayId(g) });
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
  });

  it("only GROUND units are eligible — space units are not", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
      .Build();
    g.loadNewState(s);

    const used = await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.heavyMissileGunship, playId: gunshipPlayId(g) });

    const res = used.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.spaceArena[0].playId);
    expect(res.fromPlayIds).not.toContain(gunshipPlayId(g)); // itself, a space unit
  });

  it("2 damage defeats a 2 HP ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, Cards.units.law.honorBoundPartisan).Build()); // 2/2

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.heavyMissileGunship, playId: gunshipPlayId(g) });
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("the Action is unavailable with no ground unit in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const used = await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.heavyMissileGunship, playId: gunshipPlayId(g) });

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("an exhausted gunship cannot use it", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build();
    s.player1.spaceArena[0].ready = false;
    g.loadNewState(s);

    const used = await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.heavyMissileGunship, playId: gunshipPlayId(g) });

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
