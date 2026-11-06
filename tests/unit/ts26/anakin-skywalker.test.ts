import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// TS26_02 Anakin Skywalker — Protect Her At All Costs (Leader, Vigilance/Heroism; unit side 4/5 Ground)
//   Front: "Action [Exhaust]: If 2 or more friendly units entered play this phase (including tokens
//           and leaders), give a Shield token to 1 of them.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Sentinel. On Attack: Give a Shield token to another friendly unit that entered play
//           this phase."
// The front counts units by who controlled them AS THEY ENTERED; one that has since left play still
// counts towards the 2, but only one still in play can get the Shield.

const ANAKIN = Cards.leaders.ts26.anakinSkywalker;
const MARINE = Cards.units.sor.battlefieldMarine;
const DROID = Cards.units.token.battleDroid;
const SHIELD = Cards.upgrades.token.shield;
const DROID_DEPLOYMENT = Cards.events.twi.droidDeployment; // Create 2 Battle Droid tokens

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(ANAKIN)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const targets = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Target" ? r.fromPlayIds ?? [] : []; };
const shielded = (u: { upgrades: { cardId: string }[] }) => u.upgrades.some(x => x.cardId === SHIELD);

function entered(g: GameTestAdapter, player: 1 | 2, playId: string, cardId = MARINE) {
  g.state.roundState.cardsEnteredPlayThisPhase.push({ fromPlayer: player, cardId, playId, reason: "played" });
}

describe("TS26_02 Anakin Skywalker — leader Action", () => {
  it("two token units created this phase count; one of them gets a Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, DROID_DEPLOYMENT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const droids = g.state.player1.groundArena.filter(u => u.cardId === DROID).map(u => u.playId);
    await g.useLeaderAbilityAsync(1);
    expect(new Set(targets(g))).toEqual(new Set(droids));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [droids[0]] });

    expect(shielded(g.state.player1.groundArena.find(u => u.playId === droids[0])!)).toBe(true);
  });

  it("only 1 unit entered play: no effect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());
    entered(g, 1, g.state.player1.groundArena[0].playId);

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("2 entered but one was defeated: the survivor gets the Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    const survivor = g.state.player1.groundArena[0].playId;
    entered(g, 1, survivor);
    entered(g, 1, "gone");

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([survivor]);
  });

  it("counts a unit that entered under your control and is now the opponent's; not the reverse", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(1, MARINE, true, 0, 1).Build());
    const mine = g.state.player1.groundArena[0].playId;
    const stolenFromMe = g.state.player2.groundArena[0].playId;
    const stolenByMe = g.state.player1.groundArena[1].playId;
    entered(g, 1, mine);
    entered(g, 1, stolenFromMe); // entered as mine, now theirs
    entered(g, 2, stolenByMe);   // entered as theirs, now mine

    await g.useLeaderAbilityAsync(1);
    expect(new Set(targets(g))).toEqual(new Set([mine, stolenFromMe]));
  });

  it("a deployed leader counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    entered(g, 1, g.state.player1.groundArena[0].playId);
    g.state.roundState.cardsEnteredPlayThisPhase.push({ fromPlayer: 1, cardId: "SOR_005", playId: "leader", reason: "deployed" });

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([g.state.player1.groundArena[0].playId]);
  });
});

describe("TS26_02 Anakin Skywalker — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const anakinIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === ANAKIN);

  it("has Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    expect(HasSentinel(ANAKIN, g.state.player1.groundArena[anakinIndex(g)].playId, 1)).toBe(true);
  });

  it("On Attack: Shield to another friendly unit that entered play this phase — not himself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());
    const fresh = g.state.player1.groundArena[0].playId;
    entered(g, 1, fresh);
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, anakinIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(targets(g)).toEqual([fresh]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fresh] });

    expect(shielded(g.state.player1.groundArena.find(u => u.playId === fresh)!)).toBe(true);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("counts a unit that entered under the opponent and is now yours", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, true, 0, 1).Build());
    const stolen = g.state.player1.groundArena[0].playId;
    entered(g, 2, stolen);
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, anakinIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(targets(g)).toEqual([stolen]);
  });

  it("is skipped when no other friendly unit entered play this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, anakinIndex(g));
    await g.chooseBaseAsync(1, 2);

    expect(res(g)).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(4);
  });
});
