import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Win-con (ai-spec Phase 3): the infinite-Credit combo with Clandestine
// Connections (SEC_264) attached. Each swing generates a Credit (LAW_238) and
// may spend 2 Credits to deal 2 damage to the enemy base — closing out the game.
function buildWinConState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // A stockpile representing previously-generated Credits.
    .WithCreditsForPlayer(1, 40)
    .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
    // Two Nowhere to Hide (-2 power each) cancel base power + Galen's Raid + SEC_264's
    // +1, keeping the Sandcrawler at 0 effective power so Galen never dies.
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      { cardId: Cards.upgrades.ash.camtono, playId: "@", owner: 1, controller: 1 },
      { cardId: Cards.upgrades.ash.nowhereToHide, playId: "@", owner: 1, controller: 1 },
      { cardId: Cards.upgrades.ash.nowhereToHide, playId: "@", owner: 1, controller: 1 },
      { cardId: Cards.upgrades.sec.clandestineConnections, playId: "@", owner: 1, controller: 1 },
    ])
    .WithCardInDiscardForPlayer(1, Cards.events.jtl.flyCasual)
    .WithGroundUnitForPlayer(2, Cards.units.law.galenErso)
    .Build();
}

// Resolves whatever prompt is currently pending for player 1. Robust to the
// internal ordering of the attacker's three On-Attack triggers (Saboteur,
// LAW_238, SEC_264). Returns false once nothing is pending.
async function resolvePending(g: GameTestAdapter): Promise<boolean> {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  if (!r) return false;
  const scId = g.state.player1.groundArena[0]?.playId;
  if (r.type === "Option") {
    const opts = r.options ?? [];
    const help = r.helperText ?? "";
    if (opts.some(o => o.includes("— On Attack") || o.includes("— Saboteur"))) {
      // On-attack ordering: resolve LAW_238 first if offered, else take the first.
      await g.chooseOptionAsync(1, opts.find(o => o.includes("Sandcrawler — On Attack")) ?? opts[0]);
    } else if (help.startsWith("Put a card from your discard")) {
      await g.chooseOptionAsync(1, "Yes");
    } else if (help.startsWith("Pay 2 to deal 2 damage")) {
      await g.chooseOptionAsync(1, "Yes");
    } else if (help.startsWith("Use Credits")) {
      await g.chooseOptionAsync(1, "Yes");
    } else if (help.startsWith("Defeat how many Credits")) {
      await g.chooseOptionAsync(1, "2");
    } else if (help.startsWith("Play Fly Casual")) {
      await g.chooseOptionAsync(1, "Yes");
    } else {
      throw new Error(`Unhandled option: "${help}" [${opts.join(", ")}]`);
    }
  } else if (r.type === "Target") {
    const ids = r.fromPlayIds ?? [];
    if (r.fromZones?.includes("Discard")) {
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.discard[0].playId] });
    } else if (scId && ids.includes(scId)) {
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [scId] }); // Fly Casual: ready the Sandcrawler
    } else if (ids.length > 0) {
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] }); // attack Galen
    } else if (r.fromZones?.includes("Base")) {
      await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] }); // SEC_264 base damage (UI path, no unit options)
    } else {
      return false; // nothing actionable
    }
  } else {
    throw new Error(`Unhandled resolution type: ${r.type}`);
  }
  return true;
}

describe("Credit win condition", () => {
  it("spends generated Credits via SEC_264 to destroy the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildWinConState());

    for (let swing = 0; swing < 20 && !g.state.defeatedPlayers.includes(2); swing++) {
      await g.attackWithGroundUnitAsync(1, 0);
      // Drain all follow-up prompts for this swing.
      for (let step = 0; step < 40 && (await resolvePending(g)); step++) { /* resolve */ }
      if (g.state.defeatedPlayers.includes(2)) break;
      await g.dispatchAsync(2, "pass-action", {}); // opponent passes between swings
    }

    expect(g.state.player2.base.damage).toBeGreaterThanOrEqual(30);
    expect(g.state.defeatedPlayers).toContain(2);
  }, 30000);
});
