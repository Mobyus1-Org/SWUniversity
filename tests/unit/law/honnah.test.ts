import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_050 Honnah — OINK! SQUEE! (3/5 Ground, cost 4, Vigilance/Aggression) —
//   "Raid 2" and "Restore 2"
//
// The only unit in the pool printing BOTH keywords, which makes her the card that pins what
// HMW_001 Asajj Ventress actually does: "replace any Raid it has or gains with Restore, or vice
// versa" REPLACES one keyword with the other, so the replaced value ADDS to the survivor.
//
//   replace Raid with Restore  -> Raid 0, Restore 4  (no power bonus, heal 4)
//   replace Restore with Raid  -> Raid 4, Restore 0  (+4 power, heal nothing)
//
// A symmetric "swap which amount each site reads" implementation makes Honnah a NO-OP — she keeps
// +2/+0 and heals 2 either way — which is how the original implementation was wrong.
//
// The direction is a choice, because with both keywords the two readings differ.

const HONNAH = Cards.units.law?.honnah ?? "LAW_050";
const ASAJJ = "HMW_001";
/** The prompt carries ids in `options` and the human wording in `optionLabels`. */
const TO_RESTORE = "HMW_001_to_restore";  // "Replace Raid With Restore"
const TO_RAID = "HMW_001_to_raid";        // "Replace Restore With Raid"
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)   // pre-damaged so Restore is observable
    .MyLeader(ASAJJ)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithGroundUnitForPlayer(1, HONNAH)
    .WithActivePlayer(1);
}

describe("LAW_050 Honnah with HMW_001 Asajj Ventress", () => {
  it("baseline: attacking normally she is Raid 2 AND Restore 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 power + Raid 2
    expect(g.state.player1.base.damage).toBe(8); // 10 - Restore 2
  });

  it("replacing Raid with Restore makes her Restore 4 and drops the power bonus", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.dispatchAsync(1, "use-ability", { cardId: ASAJJ });
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, TO_RESTORE);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);  // 3 power, no Raid
    expect(g.state.player1.base.damage).toBe(6);  // 10 - 4
  });

  it("replacing Restore with Raid makes her Raid 4 and heals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.dispatchAsync(1, "use-ability", { cardId: ASAJJ });
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, TO_RAID);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7);  // 3 power + Raid 4
    expect(g.state.player1.base.damage).toBe(10); // unhealed
  });

  it("the two directions are genuinely different — she is never a no-op", async () => {
    // The regression guard: a symmetric swap gives 5 / 8 for BOTH directions, matching the
    // baseline exactly and making Asajj do nothing at all to her.
    //
    // The numbers are captured BEFORE the second board is built: the engine keeps a singleton
    // game, so a second GameTestAdapter replaces the first and reading `a.state` afterwards
    // reports the wrong board.
    async function attackWith(direction: string) {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());
      await g.dispatchAsync(1, "use-ability", { cardId: ASAJJ });
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseOptionAsync(1, direction);
      await g.chooseBaseAsync(1, 2);
      return { theirs: g.state.player2.base.damage, mine: g.state.player1.base.damage };
    }

    const toRestore = await attackWith(TO_RESTORE);
    const toRaid = await attackWith(TO_RAID);

    expect(toRestore.theirs).not.toBe(toRaid.theirs);
    expect(toRestore.mine).not.toBe(toRaid.mine);
    // And neither matches the un-swapped baseline of 5 damage / 8 remaining.
    expect([toRestore.theirs, toRaid.theirs]).not.toContain(5);
  });

  it("offers both directions as named choices", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.dispatchAsync(1, "use-ability", { cardId: ASAJJ });
    await g.chooseGroundUnitAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Option");
    const labels = pending?.type === "Option" ? (pending.optionLabels ?? []) : [];
    expect(labels).toContain("Replace Raid With Restore");
    expect(labels).toContain("Replace Restore With Raid");
  });
});
