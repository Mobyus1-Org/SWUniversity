import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// CR 4.1.c — "End of the action phase. Any lasting effects that expire when the action phase ends
// expire now (e.g. 'for this phase')." CR 5.1.e — the end of the regroup phase expires "for this
// round" effects (and "for this phase" ones created during regroup). A round is action + regroup.

const VD = Cards.events.ic27.vigilantDefense; // +0/+3 and Sentinel for this phase
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, VD);
  for (let i = 0; i < 4; i++) b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
  return b;
}

async function buffWithVigilantDefense(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
}

async function endActionPhase(g: GameTestAdapter) {
  await g.dispatchAsync(2, "pass-action", {});
  await g.dispatchAsync(1, "pass-action", {});
}

describe("lasting-effect expiry (CR 4.1.c / 5.1.e)", () => {
  it("a 'for this phase' buff and keyword expire when the action phase ends, before the regroup draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SECURITY).Build());

    await buffWithVigilantDefense(g);
    const unit = () => Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit().TotalHP()).toBe(10);
    await endActionPhase(g);

    expect(g.state.gamePhase).toBe("RegroupResource"); // the draw step is done
    expect(unit().TotalHP()).toBe(7);
    expect(HasSentinel(unit().cardId, unit().playId, 1)).toBe(false);
    expect(g.state.currentEffects.some(e => e.duration === "Phase")).toBe(false);
  });

  it("a unit kept alive only by the expiring +0/+3 is defeated as the action phase ends", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, SECURITY, true, 6).Build();
    state.player1.base.damage = 5;
    g.loadNewState(state);

    await buffWithVigilantDefense(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] }); // heal the base, not the unit
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    g.state.player1.groundArena[0].damage = 8; // alive at 8/10 while the buff lasts
    await g.dispatchAsync(2, "pass-action", {});
    expect(g.state.player1.groundArena).toHaveLength(1);
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(SECURITY);
  });

  it("a 'for this round' effect survives the end of the action phase", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, SECURITY).Build();
    state.currentEffects.push({
      cardId: "SOR_186_no_ready", duration: "Round", affectedPlayer: 1, targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_186_no_ready")).toBe(true);
  });
});
