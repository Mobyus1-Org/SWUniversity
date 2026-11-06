import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_04 Padmé Amidala — Follow My Lead (Leader, Command/Heroism; unit side 5/6 Ground)
//   Front: "Action [Exhaust]: If 2 or more friendly units entered play this phase (including tokens
//           and leaders), attack with 1 of them, even if it's exhausted. It can't attack bases for
//           this attack. Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "When Attack Ends: You may attack with another friendly unit that entered play this
//           phase, even if it's exhausted. It can't attack bases for this attack."

const PADME = Cards.leaders.ts26.padmeAmidala;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const TURTLE = Cards.units.ash.dinosaurTurtle;    // 7/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(PADME)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const targets = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Target" ? r.fromPlayIds ?? [] : []; };
const zones = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Target" ? r.fromZones ?? [] : []; };

function entered(g: GameTestAdapter, player: 1 | 2, playId: string) {
  g.state.roundState.cardsEnteredPlayThisPhase.push({ fromPlayer: player, cardId: MARINE, playId, reason: "played" });
}

describe("TS26_04 Padmé Amidala — leader Action", () => {
  it("an exhausted unit that entered play attacks a unit, never a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, false).WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, TURTLE).Build());
    const [tired, other] = g.state.player1.groundArena.map(u => u.playId);
    entered(g, 1, tired);
    entered(g, 1, other);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [tired] });
    expect(zones(g)).not.toContain("Base");
    expect(targets(g)).toEqual([g.state.player2.groundArena[0].playId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("only 1 entered: no attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());
    entered(g, 1, g.state.player1.groundArena[0].playId);

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("2 entered but one was defeated: the survivor attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());
    const survivor = g.state.player1.groundArena[0].playId;
    entered(g, 1, survivor);
    entered(g, 1, "gone");

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([survivor]);
  });

  it("with no enemy unit, the chosen unit can't attack at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());
    g.state.player1.groundArena.forEach(u => entered(g, 1, u.playId));

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(res(g)).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});

describe("TS26_04 Padmé Amidala — deployed When Attack Ends", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const padmeIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === PADME);

  it("may attack with another friendly unit that entered play, even exhausted, not at a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, false).WithGroundUnitForPlayer(2, TURTLE).Build());
    const fresh = g.state.player1.groundArena[0].playId;
    entered(g, 1, fresh);
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, padmeIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(5);
    await g.chooseYesAsync(1);
    expect(targets(g)).toEqual([fresh]); // not Padmé herself
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fresh] });
    expect(zones(g)).not.toContain("Base");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());
    entered(g, 1, g.state.player1.groundArena[0].playId);
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, padmeIndex(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(true);
  });

  it("is skipped when no other friendly unit entered play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, padmeIndex(g));
    await g.chooseBaseAsync(1, 2);

    expect(res(g)).toBeFalsy();
  });
});
