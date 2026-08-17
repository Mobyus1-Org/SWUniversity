import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// LAW_015 Jabba the Hutt — Crime Boss (leader; deployed 3/9 Ground, Underworld/Hutt)
// FRONT:    "Action [1 resource, Exhaust, return a friendly Underworld unit to its owner's hand]:
//            Create a Credit token."
//           "Epic Action: If you control 6 or more resources, deploy this leader."
// DEPLOYED: "Action: Play an Underworld unit from your hand. If you defeated a Credit while paying
//            its cost, that unit gains Ambush for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.law.jabbaTheHutt)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const credits = (g: GameTestAdapter) => g.state.player1.supplemental.creditTokens ?? 0;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("LAW_015 Jabba the Hutt — leader side Action", () => {
  it("returns a friendly Underworld unit to hand, pays 1, exhausts, and creates a Credit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.law.salaciousCrumbLaw).Build(), // Underworld
    );
    const before = readyResources(g);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.law.salaciousCrumbLaw);
    expect(credits(g)).toBe(1);
    expect(readyResources(g)).toBe(before - 1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("only UNDERWORLD units are offered as the cost", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.law.salaciousCrumbLaw)      // Underworld
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)      // Rebel — not eligible
      .Build();
    g.loadNewState(state);

    const used = await g.useLeaderAbilityAsync(1);

    const res = used.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player1.groundArena[1].playId);
  });

  it("the ability is unavailable with no friendly Underworld unit to return", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(credits(g)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("the ability is unavailable with no resource to pay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.law.jabbaTheHutt)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .WithGroundUnitForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(credits(g)).toBe(0);
  });

  it("an enemy Underworld unit is not a legal cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.law.salaciousCrumbLaw).Build());

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});

describe("LAW_015 Jabba the Hutt — deployed side Action", () => {
  async function deployedJabba(builder: GameStateBuilder) {
    const g = new GameTestAdapter();
    g.loadNewState(builder.Build());
    await g.deployLeaderAsync(1);
    return g;
  }

  const jabbaPlayId = (g: GameTestAdapter) =>
    g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.law.jabbaTheHutt)!.playId;

  it("plays an Underworld unit from hand, paying its cost", async () => {
    const g = await deployedJabba(
      baseSetup().WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw),
    );
    const before = readyResources(g);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.law.salaciousCrumbLaw)).toBe(true);
    expect(readyResources(g)).toBeLessThan(before);
  });

  it("defeating a Credit while paying gives that unit Ambush for this phase", async () => {
    const g = await deployedJabba(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.law.jabbaTheHutt)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        // Exactly 6 resources (the deploy threshold) and no ready ones left after deploying, so
        // the Credit is the only way to pay — the payment is forced, not a choice.
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6, false)
        .WithCreditsForPlayer(1, 1)
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw), // cost 1
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    const crumb = g.state.player1.groundArena.find(u => u.cardId === Cards.units.law.salaciousCrumbLaw)!;
    expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
    expect(HasAmbush(Cards.units.law.salaciousCrumbLaw, crumb.playId, "Hand", 1)).toBe(true);
  });

  it("does not exhaust him — the deployed text is a plain 'Action:' with no [Exhaust] cost", async () => {
    const g = await deployedJabba(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw)
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw),
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.law.jabbaTheHutt)!.ready).toBe(true);

    // …so it can be used again the same phase, bounded only by hand and resources.
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.law.salaciousCrumbLaw)).toHaveLength(2);
  });

  it("control: paying with resources only grants no Ambush", async () => {
    const g = await deployedJabba(
      baseSetup().WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw),
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    const crumb = g.state.player1.groundArena.find(u => u.cardId === Cards.units.law.salaciousCrumbLaw)!;
    expect(HasAmbush(Cards.units.law.salaciousCrumbLaw, crumb.playId, "Hand", 1)).toBe(false);
  });

  it("a non-Underworld card in hand cannot be chosen", async () => {
    const g = await deployedJabba(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)      // index 0 — ineligible
        .WithCardInHandForPlayer(1, Cards.units.law.salaciousCrumbLaw),     // makes the Action legal
    );

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });
    const chosen = await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(chosen.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });

  it("the deployed Action is unavailable with no Underworld unit in hand", async () => {
    const g = await deployedJabba(
      baseSetup().WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine),
    );

    await g.dispatchAsync(2, "pass-action", {});
    const used = await g.dispatchAsync(1, "use-ability", { playId: jabbaPlayId(g) });

    expect(used.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
