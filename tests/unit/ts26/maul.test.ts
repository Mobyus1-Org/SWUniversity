import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_03 Maul — Collective Ambition (Leader, Command/Villainy; unit side 5/9 Ground)
//   Front: "Action [Exhaust]: Choose a unit. If it has more different keywords than it has
//           Experience tokens on it, give an Experience token to it and deal 1 damage to it.
//           Epic Action: If you control 7 or more resources, deploy this leader."
//   Unit:  "When Deployed/On Attack: Choose a unit. If it has more different keywords than it has
//           Experience tokens on it, give an Experience token to it and deal 1 damage to it."
// Granted keywords count; a numeric keyword counts once however it stacks. The token lands before
// the damage, so a unit at 1 remaining HP survives.

const MAUL = Cards.leaders.ts26.maul;
const SHD_MAUL = Cards.units.shd.maul;            // 7/6 — Ambush, Overwhelm
const WAMPA = Cards.units.sor.wampa;              // 4/5 — Overwhelm
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 — no keywords
const BRAGGART = Cards.units.sor.cantinaBraggart; // Raid 2
const PAIGE = Cards.units.jtl.paigeTico;          // printed Piloting
const PROTECTOR = Cards.upgrades.sor.protector;   // attached unit gains Sentinel
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(MAUL)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

async function maulAction(g: GameTestAdapter, playId: string) {
  await g.useLeaderAbilityAsync(1);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [playId] });
}

describe("TS26_03 Maul — leader Action", () => {
  it("a unit with 2 keywords and no Experience gets an Experience token and 1 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SHD_MAUL).Build());
    const target = g.state.player2.groundArena[0];

    await maulAction(g, target.playId);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("2 keywords and 1 Experience still qualifies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SHD_MAUL)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(XP, 1)]).Build());

    await maulAction(g, g.state.player1.groundArena[0].playId);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(2);
  });

  it("1 keyword and 1 Experience: no effect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(XP, 2)])
      .WithGroundUnitForPlayer(2, SHD_MAUL).Build());

    await maulAction(g, g.state.player2.groundArena[0].playId);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("a stacked numeric keyword counts once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, BRAGGART)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(XP, 2)]).Build());
    const braggart = g.state.player2.groundArena[0].playId;
    g.state.currentEffects.push({ cardId: "LAW_012", duration: "Phase", affectedPlayer: 2, targetPlayId: braggart }); // + Raid 1

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy(); // Raid 3 is one keyword: 1 > 1 fails, so nothing qualifies
  });

  it("keywords granted by an upgrade count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(PROTECTOR, 1)]).Build());

    await maulAction(g, g.state.player1.groundArena[0].playId);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
  });

  it("a printed Piloting counts as a keyword on a unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, PAIGE).Build());

    await maulAction(g, g.state.player2.groundArena[0].playId);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("the Experience lands first: a unit at 1 remaining HP survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, true, 2)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(PROTECTOR, 1)]).Build());

    await maulAction(g, g.state.player1.groundArena[0].playId);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("with no qualifying unit there is no choice, and Maul still exhausts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("choosing a unit that doesn't qualify does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, SHD_MAUL).Build());

    await maulAction(g, g.state.player2.groundArena[0].playId);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});

describe("TS26_03 Maul — deployed", () => {
  it("When Deployed: the same choice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SHD_MAUL).Build());

    await g.deployLeaderAsync(1);
    expect(res(g)?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("On Attack: the same choice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await g.deployLeaderAsync(1); // nothing qualifies yet
    g.state.player2.groundArena.push(...new GameStateBuilder().WithGroundUnitForPlayer(2, SHD_MAUL).Build().player2.groundArena.map(u => ({ ...u, playId: "999" })));
    await g.dispatchAsync(2, "pass-action", {});

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === MAUL));
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["999"] });

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
    expect(g.state.player2.base.damage).toBe(5);
  });
});
