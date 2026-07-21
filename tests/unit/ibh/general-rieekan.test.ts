import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_023 General Rieekan (2/6 Ground, cost 4, Rebel Official, Command/Heroism)
// "Action [Exhaust]: Attack with another Heroism unit. It gets +2/+0 for this attack."

function setup(rieekanId = Cards.units.ibh.generalRieekan, withHeroismUnit = true) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, rieekanId);
  if (withHeroismUnit) b = b.WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine); // 3/3 Heroism
  return b;
}

describe("IBH_023 General Rieekan — Action: attack with another Heroism unit +2/+0", () => {
  it("the chosen Heroism unit attacks with +2/+0 and Rieekan exhausts", async () => {
    const g = new GameTestAdapter();
    const s = setup().Build();
    g.loadNewState(s);
    const rieekanPlayId = s.player1.groundArena[0].playId;
    const marinePlayId = s.player1.groundArena[1].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.generalRieekan, playId: rieekanPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    await g.chooseBaseAsync(1, 2); // the Marine attacks the enemy base

    expect(g.state.player2.base.damage).toBe(5); // Marine 3 + 2
    expect(g.state.player1.groundArena.find(u => u.playId === rieekanPlayId)!.ready).toBe(false);
  });

  it("control: no other Heroism unit → ability not available (no-op)", async () => {
    const g = new GameTestAdapter();
    const s = setup(Cards.units.ibh.generalRieekan, false).Build();
    g.loadNewState(s);
    const rieekanPlayId = s.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.generalRieekan, playId: rieekanPlayId });

    // Nothing to attack with — Rieekan stays ready, base untouched.
    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("alt printing IBH_036 also grants the +2/+0 attack", async () => {
    const g = new GameTestAdapter();
    const s = setup(Cards.units.ibh.generalRieekanB).Build();
    g.loadNewState(s);
    const rieekanPlayId = s.player1.groundArena[0].playId;
    const marinePlayId = s.player1.groundArena[1].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.generalRieekanB, playId: rieekanPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });
});
