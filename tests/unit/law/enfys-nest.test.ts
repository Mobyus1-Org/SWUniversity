import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_014 Enfys Nest — Until We Can Go No Higher (Leader, Aggression/Heroism; unit side 3/7 Ground)
//   Front: "When you use an 'On Attack' ability: You may pay 2 resources and exhaust this leader.
//           If you do, use that ability again.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "When you use an 'On Attack' ability: You may use that ability again. Use this ability
//           only once each round."
// A declined "may" On Attack was not used (CR 32.3), so it gets no offer. Each ability used gets
// its own offer, right after it resolves.

const ENFYS = Cards.leaders.law.enfysNest;
const YWING = Cards.units.ibh.rebellionYWing;      // 2/3 Space — On Attack: deal 1 damage to a base
const JARJAR = Cards.units.ic27.jarJarBinks;       // On Attack: discard the top card of your deck
const ACOLYTE = Cards.units.lof.acolyteOfTheBeyond; // On Attack/When Defeated: The Force is with you
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;
const BATTLE_FURY = Cards.upgrades.lof.battleFury;           // grants "On Attack: Discard a card from your hand."
const HOLOCRON = Cards.upgrades.lof.sithHolocron;            // grants "On Attack: You may deal 2 to a friendly unit…"
const COMPARTMENT = Cards.upgrades.sor.smugglingCompartment; // grants "On Attack: Ready a resource."

function board(resources = 2, deployed = false) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(ENFYS, true, deployed, deployed)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
  if (deployed) b = b.WithGroundUnitForPlayer(1, ENFYS);
  return b;
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const enfysOffer = (g: GameTestAdapter) => {
  const r = res(g);
  return r?.type === "Option" && /On Attack" ability again/.test(r.helperText ?? "") ? r : undefined;
};
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

async function yWingHitsBase(g: GameTestAdapter, index = 0) {
  await g.attackWithSpaceUnitAsync(1, index);
  await g.chooseBaseAsync(1, 2);
  await g.chooseBaseAsync(1, 2); // its On Attack: 1 damage to a base
}

describe("LAW_014 Enfys Nest — leader side", () => {
  it("pay 2 and exhaust her: the On Attack ability is used again, then the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, YWING).Build());

    await yWingHitsBase(g);
    expect(enfysOffer(g)).toBeTruthy();
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2); // the On Attack again

    expect(g.state.player2.base.damage).toBe(4); // 1 + 1 + combat 2
    expect(readyResources(g)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(res(g)).toBeFalsy();
  });

  it("declining: nothing paid, the ability runs once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, YWING).Build());

    await yWingHitsBase(g);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(3);
    expect(readyResources(g)).toBe(2);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("with only 1 resource there is no offer at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).WithSpaceUnitForPlayer(1, YWING).Build());

    await yWingHitsBase(g);

    expect(enfysOffer(g)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("once she is exhausted, a later On Attack gets no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4).WithSpaceUnitForPlayer(1, YWING).WithSpaceUnitForPlayer(1, YWING).Build());

    await yWingHitsBase(g, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await yWingHitsBase(g, 1);

    expect(enfysOffer(g)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("declining doesn't spend her: a later On Attack is offered again", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, YWING).WithSpaceUnitForPlayer(1, YWING).Build());

    await yWingHitsBase(g, 0);
    await g.chooseNoAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await yWingHitsBase(g, 1);
    expect(enfysOffer(g)).toBeTruthy();
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7); // 3 + 4
  });

  it("not for the opponent's On Attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(2, YWING).WithActivePlayer(2).Build());

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);
    await g.chooseBaseAsync(2, 1);

    expect(enfysOffer(g)).toBeUndefined();
    expect(g.state.player1.base.damage).toBe(3);
  });

  it("not for the When Defeated half of an On Attack/When Defeated ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, ACOLYTE).WithGroundUnitForPlayer(2, WAMPA).WithActivePlayer(2).Build());

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
    expect(enfysOffer(g)).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("an On Attack with no prompt (Jar Jar's discard) is used again too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, JARJAR)
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.deck).toHaveLength(1);
    await g.chooseYesAsync(1);

    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("each ability gets its own offer: pass on Battle Fury's, take Jar Jar's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, JARJAR)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(BATTLE_FURY, 1)])
      .WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA)
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0); // Battle Fury's discard
    expect(enfysOffer(g)?.helperText).toMatch(/Battle Fury/);
    await g.chooseNoAsync(1);
    expect(enfysOffer(g)?.helperText).toMatch(/Jar Jar/);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand).toHaveLength(1); // Battle Fury ran once
    expect(g.state.player1.deck).toHaveLength(0); // Jar Jar ran twice
    expect(g.state.player1.leader.ready).toBe(false);
    expect(res(g)).toBeFalsy();
  });

  it("a declined 'may' On Attack was not used, so there is no offer; a used one gets one", async () => {
    for (const use of [false, true]) {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(HOLOCRON, 1)]).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      if (use) {
        await g.chooseYesAsync(1);
        await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
        expect(enfysOffer(g)).toBeTruthy();
      } else {
        await g.chooseNoAsync(1);
        expect(enfysOffer(g)).toBeUndefined();
        expect(g.state.player2.base.damage).toBe(4); // 3 + Holocron's +1
      }
    }
  });
});

describe("LAW_014 Enfys Nest — deployed", () => {
  it("free, and only once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2, true).WithSpaceUnitForPlayer(1, YWING).WithSpaceUnitForPlayer(1, YWING).Build());

    await yWingHitsBase(g, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);
    expect(readyResources(g)).toBe(2);
    expect(g.state.player2.base.damage).toBe(4);

    await g.dispatchAsync(2, "pass-action", {});
    await yWingHitsBase(g, 1);
    expect(enfysOffer(g)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("an upgrade-granted On Attack (Smuggling Compartment) is used again", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2, true).WithSpaceUnitForPlayer(1, Cards.units.sor.allianceXWing) // no On Attack of its own
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(COMPARTMENT, 1)]).Build());
    g.state.player1.resources.forEach(r => { r.ready = false; });

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(enfysOffer(g)?.helperText).toMatch(/Smuggling Compartment/);
    await g.chooseYesAsync(1);
    expect(readyResources(g)).toBe(2);
  });

  it("deploys at 5 resources, not 4", async () => {
    const four = new GameTestAdapter();
    four.loadNewState(board(4).Build());
    await four.deployLeaderAsync(1);
    expect(four.state.player1.leader.deployed).toBeFalsy();

    const five = new GameTestAdapter();
    five.loadNewState(board(5).Build());
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBe(true);
  });
});
