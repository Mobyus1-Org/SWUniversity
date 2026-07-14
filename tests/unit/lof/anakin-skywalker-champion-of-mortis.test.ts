import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_070 Anakin Skywalker — Champion of Mortis (5/7 Ground, cost 6)
// "When Played: If there is a Heroism card in your discard pile, you may give a unit –3/–3 for this phase."
// "When Played: If there is a Villainy card in your discard pile, you may give a unit –3/–3 for this phase."
// Two independent When Played abilities — when both are live, the controller picks the order.

// Battlefield Marine (SOR_095) is a Heroism card; Admiral Motti (SOR_226) is a Villainy card.
const HEROISM_CARD = Cards.units.sor.battlefieldMarine;
const VILLAINY_CARD = Cards.units.sor.admiralMotti;

function setup(discard: string[]) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithCardInHandForPlayer(1, Cards.units.lof.anakinSkywalkerChampionOfMortis)
    // Two enemy 3/3 Battlefield Marines as debuff targets.
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
  for (const c of discard) b = b.WithCardInDiscardForPlayer(1, c);
  return b.Build();
}

function enemy(g: GameTestAdapter, i: number) {
  return Unit.FromInterface(g.state.player2.groundArena[i]);
}

/** The option ids of a prompt, when it is an option-style resolution. */
function promptOptions(g: GameTestAdapter): string[] | undefined {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r && "options" in r ? (r.options as string[]) : undefined;
}

describe("LOF_070 Anakin Skywalker — Champion of Mortis", () => {
  it("Heroism only: gives a unit –3/–3, with no order prompt", async () => {
    const g = new GameTestAdapter();
    // Scavenging Sandcrawler is 1/7, so it survives the debuff and its stats stay observable.
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.lof.anakinSkywalkerChampionOfMortis)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .WithCardInDiscardForPlayer(1, HEROISM_CARD)
      .Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);
    // Only one ability is live, so it goes straight to its Yes/No — no order prompt.
    expect(promptOptions(played)).toEqual(["Yes", "No"]);

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    const target = enemy(g, 0);
    expect(target.CurrentPower()).toBe(0); // 1 - 3, floored at 0
    expect(target.TotalHP()).toBe(4); // 7 - 3
  });

  it("a 3/3 debuffed to 0/0 is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([HEROISM_CARD]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("Villainy only: gives a unit –3/–3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([VILLAINY_CARD]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1);

    // 3/3 reduced to 0/0 → defeated by the sweep.
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("no discard match: neither ability triggers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([])); // empty discard

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(enemy(g, 0).CurrentPower()).toBe(3);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.lof.anakinSkywalkerChampionOfMortis)).toBe(true);
  });

  it("both live: prompts for the order, and BOTH abilities resolve (Heroism first)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([HEROISM_CARD, VILLAINY_CARD]));

    const played = await g.playCardFromHandAsync(1, 0);
    // The order prompt lists both abilities as selectable options.
    expect(promptOptions(played)).toEqual(["heroism", "villainy"]);

    await g.chooseOptionAsync(1, "heroism");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // Heroism ability debuffs Marine A → 0/0, defeated
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // Villainy ability debuffs the remaining Marine

    // Both Marines are gone: each took –3/–3 from a separate ability.
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("both live: the order can be reversed (Villainy first)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([HEROISM_CARD, VILLAINY_CARD]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "villainy");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("both live: each ability may be declined independently", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([HEROISM_CARD, VILLAINY_CARD]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "heroism");
    await g.chooseNoAsync(1); // decline the Heroism ability
    await g.chooseYesAsync(1); // still offered the Villainy ability
    await g.chooseGroundUnitAsync(2, 0);

    expect(enemy(g, 0).CurrentPower()).toBe(3); // untouched Marine (index shifted after the defeat)
    expect(g.state.player2.groundArena).toHaveLength(1); // only one was debuffed to 0/0
  });

  it("both live: declining both leaves the board untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([HEROISM_CARD, VILLAINY_CARD]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "heroism");
    await g.chooseNoAsync(1);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(2);
    expect(enemy(g, 0).CurrentPower()).toBe(3);
    expect(enemy(g, 1).CurrentPower()).toBe(3);
  });
});
