import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { CardInPlay } from "@/lib/engine/core-models";

// LAW_078 Sabine Wren — Spectre Five (3/3 Ground, cost 3)
// "Ambush"
// "When Played: You may defeat a non-unique upgrade. If you control a Vigilance or Command unit,
//  you may defeat an upgrade instead."

function upg(cardId: string, owner: 1 | 2): CardInPlay[] {
  return [{ cardId, playId: "@", owner, controller: owner }];
}

// Shield (SOR_T02) is a non-unique token upgrade. Luke's Lightsaber (SOR_147-era unique upgrade)
// stands in for the unique case.
const NON_UNIQUE_UPGRADE = Cards.upgrades.token.shield;
const UNIQUE_UPGRADE = Cards.upgrades.sor.lukesLightsaber;

function setup(opts: { upgrade: string; vigilanceOrCommandUnit?: boolean }) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithCardInHandForPlayer(1, Cards.units.law.sabineWren)
    // Enemy unit carrying the upgrade Sabine may defeat.
    .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
    .WithUpgradesOnGroundUnitForPlayer(2, 0, upg(opts.upgrade, 2));
  if (opts.vigilanceOrCommandUnit) {
    // Battlefield Marine is a Command unit.
    b = b.WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine);
  }
  return b.Build();
}

function upgradesOnEnemy(g: GameTestAdapter) {
  return g.state.player2.groundArena[0].upgrades;
}

// Sabine enters with two simultaneous triggers (Ambush + When Played), so the controller is
// asked which resolves first. These helpers pick one.
const WHEN_PLAYED = "Sabine Wren — When Played";
const AMBUSH = "Sabine Wren — Ambush";

/** The option ids of a prompt, when it is an option-style resolution. */
function promptOptions(g: GameTestAdapter): string[] | undefined {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r && "options" in r ? (r.options as string[]) : undefined;
}

describe("LAW_078 Sabine Wren — Ambush", () => {
  it("has Ambush", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ upgrade: NON_UNIQUE_UPGRADE }));
    expect(HasAmbush(Cards.units.law.sabineWren)).toBe(true);
  });
});

describe("LAW_078 Sabine Wren — When Played", () => {
  it("defeats a non-unique upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ upgrade: NON_UNIQUE_UPGRADE }));

    const played = await g.playCardFromHandAsync(1, 0);
    // Ambush + When Played are simultaneous — resolve the When Played first.
    expect(promptOptions(played)).toEqual([AMBUSH, WHEN_PLAYED]);
    await g.chooseOptionAsync(1, WHEN_PLAYED);
    await g.chooseYesAsync(1); // defeat an upgrade
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(upgradesOnEnemy(g)).toHaveLength(0);
  });

  it("cannot target a UNIQUE upgrade without a Vigilance or Command unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ upgrade: UNIQUE_UPGRADE }));

    // The only upgrade in play is unique and Sabine controls no Vigilance/Command unit, so her
    // When Played has no legal target and never triggers — Ambush is the ONLY trigger, so there
    // is no order prompt.
    const played = await g.playCardFromHandAsync(1, 0);
    expect(promptOptions(played)).not.toEqual([AMBUSH, WHEN_PLAYED]);
    await g.chooseNoAsync(1); // decline the Ambush attack

    expect(upgradesOnEnemy(g)).toHaveLength(1); // the unique upgrade survives
  });

  it("CAN defeat a unique upgrade while you control a Command unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ upgrade: UNIQUE_UPGRADE, vigilanceOrCommandUnit: true }));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, WHEN_PLAYED);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(upgradesOnEnemy(g)).toHaveLength(0);
  });

  it("declining leaves the upgrade in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ upgrade: NON_UNIQUE_UPGRADE }));

    await g.playCardFromHandAsync(1, 0);
    const chosen = await g.chooseOptionAsync(1, WHEN_PLAYED);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(promptOptions(chosen)).toEqual(["Yes", "No"]);
    await g.chooseNoAsync(1);

    expect(upgradesOnEnemy(g)).toHaveLength(1);
  });

  it("no When Played prompt when there is no upgrade in play", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.law.sabineWren)
      .Build();
    g.loadNewState(s);

    // With no upgrades anywhere, the When Played never triggers — Ambush is the only trigger,
    // so there is no order prompt.
    const played = await g.playCardFromHandAsync(1, 0);
    expect(promptOptions(played)).not.toEqual([AMBUSH, WHEN_PLAYED]);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.law.sabineWren)).toBe(true);
  });
});
