import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_164 Chief Chirpa — Defiant Elder (1/5 Ground, cost 2, Aggression/Heroism, Ewok, unique)
// "This unit gets +1/+0 for each other friendly Ewok unit."
const CHIRPA = Cards.units.hmw.chiefChirpa;
const EWOK = Cards.units.hmw.ewokBrigade;          // 2/4 Ewok, no text
const NON_EWOK = Cards.units.sor.battlefieldMarine; // 3/3 Rebel Trooper

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const chirpa = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === CHIRPA)!);

describe("HMW_164 Chief Chirpa — Defiant Elder", () => {
  it("with no other friendly Ewok he is a plain 1/5 (he does not count himself)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, CHIRPA).WithGroundUnitForPlayer(1, NON_EWOK).Build());
    expect(chirpa(g).CurrentPower()).toBe(1);
    expect(chirpa(g).TotalHP()).toBe(5);
  });

  it("gets +1/+0 for each other friendly Ewok unit — HP unchanged", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, CHIRPA)
        .WithGroundUnitForPlayer(1, EWOK)
        .WithGroundUnitForPlayer(1, EWOK)
        .WithGroundUnitForPlayer(1, NON_EWOK)
        .Build(),
    );
    expect(chirpa(g).CurrentPower()).toBe(3);
    expect(chirpa(g).TotalHP()).toBe(5);
  });

  it("enemy Ewoks do not count", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, CHIRPA)
        .WithGroundUnitForPlayer(1, EWOK)
        .WithGroundUnitForPlayer(2, EWOK)
        .WithGroundUnitForPlayer(2, EWOK)
        .Build(),
    );
    expect(chirpa(g).CurrentPower()).toBe(2);
  });

  it("counts nothing while he has lost his abilities", () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, CHIRPA).WithGroundUnitForPlayer(1, EWOK).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);
    expect(chirpa(g).CurrentPower()).toBe(1);
  });
});
