import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// LAW_034 Chewbacca — Mighty Rescuer (4/4 Ground, Rebel/Wookiee, cost 4)
//   "Overwhelm"
//   "When Attack Ends: If the defending unit was defeated, give an Experience token to this unit
//    and heal 3 damage from him."
//
// Salacious Crumb (LAW_210, 0/2) is the defender in the "defeated" cases: he dies to Chewie's 4
// power and deals no counter-damage, so Chewie survives to fire his own When Attack Ends.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const chewie = (g: GameTestAdapter) =>
  g.state.player1.groundArena.find(u => u.cardId === Cards.units.law.chewbaccaMightyRescuer)!;
const xpCount = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.experience).length;

describe("LAW_034 Chewbacca — Overwhelm", () => {
  it("has Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.law.chewbaccaMightyRescuer).Build());

    expect(HasOverwhelm(Cards.units.law.chewbaccaMightyRescuer, chewie(g).playId, 1)).toBe(true);
  });

  it("excess combat damage spills to the defending player's base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.chewbaccaMightyRescuer)
        .WithGroundUnitForPlayer(2, Cards.units.law.salaciousCrumbLaw) // 0/2
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(2); // 4 power − 2 HP
  });
});

describe("LAW_034 Chewbacca — When Attack Ends", () => {
  it("defeating the defender gives him an Experience token and heals 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.chewbaccaMightyRescuer, true, 3)
        .WithGroundUnitForPlayer(2, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xpCount(chewie(g))).toBe(1);
    expect(chewie(g).damage).toBe(0); // 3 damage healed away
  });

  it("heals only up to full — 2 damage does not go negative", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.chewbaccaMightyRescuer, true, 2)
        .WithGroundUnitForPlayer(2, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(chewie(g).damage).toBe(0);
    expect(xpCount(chewie(g))).toBe(1);
  });

  it("control: a defender that SURVIVES gives no token and no healing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.chewbaccaMightyRescuer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives 4
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(xpCount(chewie(g))).toBe(0);
    expect(chewie(g).damage).toBe(3); // took the counter-damage, kept it
  });

  it("control: attacking a BASE has no defending unit, so nothing triggers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.chewbaccaMightyRescuer, true, 3)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
    expect(xpCount(chewie(g))).toBe(0);
    expect(chewie(g).damage).toBe(3);
  });
});
