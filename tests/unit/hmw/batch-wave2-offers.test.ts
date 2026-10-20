import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// Wave 2 — three cards built from offer shapes the engine already has.
//
//   HMW_097 Dire Prowess       +1/+1 Upgrade  "When Played: You may give a Weakness token to a unit."
//   HMW_063 Rho Medical Shuttle 3/3 Space     "When Played/On Attack: You may heal 1 damage from
//                                              ANOTHER unit or base."
//   HMW_111 Invasion Lander     3/7 Space     "When Played: Give each OTHER friendly unit +2/+2
//                                              for this phase."
const PROWESS = Cards.upgrades.hmw.direProwess;
const SHUTTLE = Cards.units.hmw.rhoMedicalShuttle;
const LANDER = Cards.units.hmw.invasionLander;
const WEAKNESS = Cards.units.token.weakness;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground

function base(myBaseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, myBaseDamage)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const allWeakness = (g: GameTestAdapter) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena,
   ...g.state.player2.groundArena, ...g.state.player2.spaceArena]
    .reduce((n, u) => n + u.upgrades.filter(up => up.cardId === WEAKNESS).length, 0);

describe("HMW_097 Dire Prowess", () => {
  it("gives +1/+1 and may give a Weakness token on play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, PROWESS)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    const host = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect({ power: host.CurrentPower(), hp: host.TotalHP() }).toEqual({ power: 4, hp: 4 });
    expect(allWeakness(g)).toBe(1);
  });

  it("the token offer may be declined, and the upgrade still attaches", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithCardInHandForPlayer(1, PROWESS)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(allWeakness(g)).toBe(0);
    expect(g.state.player1.groundArena[0].upgrades.some(up => up.cardId === PROWESS)).toBe(true);
  });
});

describe("HMW_063 Rho Medical Shuttle", () => {
  it("When Played: may heal 1 from another unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE, true, 2) // 2 damage to heal
      .WithCardInHandForPlayer(1, SHUTTLE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("the heal may target a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(4).WithCardInHandForPlayer(1, SHUTTLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(3);
  });

  it("never offers ITSELF — the text says 'another'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, SHUTTLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const shuttle = g.state.player1.spaceArena.find(x => x.cardId === SHUTTLE)!;
    expect(offered(g)).not.toContain(shuttle.playId);
    // Both bases are still legal targets.
    expect(offered(g)).toContain("player1.base");
  });

  it("On Attack: the same offer fires again", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, SHUTTLE)
      .WithGroundUnitForPlayer(1, MARINE, true, 2)
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("the On Attack offer may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, SHUTTLE)
      .WithGroundUnitForPlayer(1, MARINE, true, 2)
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].damage).toBe(2); // untouched
    expect(g.state.player2.base.damage).toBe(3);           // the attack still happened
  });
});

describe("HMW_111 Invasion Lander", () => {
  it("gives each OTHER friendly unit +2/+2, and not itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithCardInHandForPlayer(1, LANDER)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    for (const m of g.state.player1.groundArena) {
      const unit = Unit.FromInterface(m);
      expect({ power: unit.CurrentPower(), hp: unit.TotalHP() }).toEqual({ power: 5, hp: 5 });
    }
    const lander = Unit.FromInterface(g.state.player1.spaceArena.find(x => x.cardId === LANDER)!);
    expect({ power: lander.CurrentPower(), hp: lander.TotalHP() }).toEqual({ power: 3, hp: 7 });
  });

  it("does not buff enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, LANDER)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    const enemy = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect({ power: enemy.CurrentPower(), hp: enemy.TotalHP() }).toEqual({ power: 3, hp: 3 });
  });

  it("is mandatory and silent with no other friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, LANDER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined(); // no prompt — it is not a "may"
    expect(g.state.player1.spaceArena.some(x => x.cardId === LANDER)).toBe(true);
  });

  it("the buff lasts the phase, not for ever", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithCardInHandForPlayer(1, LANDER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(5);

    g.state.currentEffects = g.state.currentEffects.filter(e => e.duration !== "Phase");
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });
});
