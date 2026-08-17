import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// LAW_210 Salacious Crumb — Cackling Companion (0/2 Ground, Underworld/Creature, cost 1)
//   "Raid 2"
//   "If you control Jabba the Hutt (as a leader or unit), this unit enters play ready."
//
// Units normally enter play EXHAUSTED, so the Jabba clause is what lets Crumb attack the turn he
// arrives. "As a leader or unit" is matched by title, so every Jabba printing counts.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const crumb = (g: GameTestAdapter) =>
  g.state.player1.groundArena.find(u => u.cardId === Cards.units.law.salaciousCrumbLaw)!;

describe("LAW_210 Salacious Crumb — Raid 2", () => {
  it("has Raid 2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    expect(RaidAmount(Cards.units.law.salaciousCrumbLaw, crumb(g).playId, 1)).toBe(2);
  });

  it("Raid 2 makes his 0 power hit for 2 while attacking", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });
});

describe("LAW_210 Salacious Crumb — enters play ready", () => {
  it("enters play EXHAUSTED with no Jabba in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(crumb(g).ready).toBe(false);
  });

  it("enters play ready while you control Jabba the Hutt as your LEADER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.law.jabbaTheHutt)
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(crumb(g).ready).toBe(true);
  });

  it("enters play ready while you control a non-leader Jabba the Hutt unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.jabbaTheHutt)
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(crumb(g).ready).toBe(true);
  });

  it("an OPPONENT's Jabba does not make him enter ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirLeader(Cards.leaders.law.jabbaTheHutt)
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(crumb(g).ready).toBe(false);
  });
});
