import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_027 Enoch — Solemn Servant (Unit 4/5 Ground, cost 4, Vigilance/Command/Villainy)
//   "When Defeated: You may deal up to 6 damage to your base. The next unit you play this phase
//    costs 1 resource less for every 2 damage dealt this way."

const ENOCH = Cards.units.ash.enoch;
const LUKE = Cards.units.sor.lukeSkywalker; // 6/7 — kills Enoch
const GUARDS = Cards.units.sor.vigilantHonorGuards; // cost 5, Vigilance/Heroism
const MARINE = Cards.units.sor.battlefieldMarine;   // cost 2

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // + Vigilance base: Guards and Marine play at printed cost
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, GUARDS)
    .WithCardInHandForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(1, ENOCH)
    .WithGroundUnitForPlayer(2, LUKE);
}

const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const handIdx = (g: GameTestAdapter, id: string) => g.state.player1.hand.findIndex(c => c.cardId === id);

async function enochDiesDealing(g: GameTestAdapter, amount: string) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseGroundUnitAsync(2, 0);
  expect(g.state.player1.groundArena).toHaveLength(0);
  await g.chooseOptionAsync(1, amount);
  await g.dispatchAsync(2, "pass-action", {});
}

describe("ASH_027 Enoch — Solemn Servant", () => {
  it("6 damage to your base → the next unit costs 3 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await enochDiesDealing(g, "6");
    expect(g.state.player1.base.damage).toBe(6);

    const before = ready(g);
    await g.playCardFromHandAsync(1, handIdx(g, GUARDS));
    expect(before - ready(g)).toBe(2); // 5 − 3
  });

  it("an odd amount rounds down — 5 damage is 2 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await enochDiesDealing(g, "5");

    const before = ready(g);
    await g.playCardFromHandAsync(1, handIdx(g, GUARDS));
    expect(before - ready(g)).toBe(3);
  });

  it("only the NEXT unit is cheaper", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await enochDiesDealing(g, "6");
    await g.playCardFromHandAsync(1, handIdx(g, MARINE)); // uses the discount (2 − 3 → 0)
    await g.dispatchAsync(2, "pass-action", {});

    const before = ready(g);
    await g.playCardFromHandAsync(1, handIdx(g, GUARDS));
    expect(before - ready(g)).toBe(5);
  });

  it("choosing 0 deals nothing and discounts nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await enochDiesDealing(g, "0");
    expect(g.state.player1.base.damage).toBe(0);

    const before = ready(g);
    await g.playCardFromHandAsync(1, handIdx(g, GUARDS));
    expect(before - ready(g)).toBe(5);
  });

  it("offers every amount from 0 to 6", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { options?: string[] };
    expect(res.options).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("two Enoch discounts stack onto the same next unit, and both are spent", async () => {
    const g = new GameTestAdapter();
    const state = setup().Build();
    state.currentEffects.push(
      { cardId: "ASH_027", duration: "Phase", affectedPlayer: 1, value: 2 },
      { cardId: "ASH_027", duration: "Phase", affectedPlayer: 1, value: 1 },
    );
    g.loadNewState(state);

    const before = ready(g);
    await g.playCardFromHandAsync(1, handIdx(g, GUARDS));
    expect(before - ready(g)).toBe(2); // 5 − 3
    expect(g.state.currentEffects.some(e => e.cardId === "ASH_027")).toBe(false);
  });
});
