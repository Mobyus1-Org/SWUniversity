import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CardTitle, CardType, CardLeaderUnitText } from "@/server/engine/card-db/generated";

// Guard against half-wired abilities — the failure mode behind the Luke Skywalker (SOR_005) bug
// report. A card can be listed in the registries that make an ability *appear* (the action-ability
// availability list, the Puzzles UI button set, HasOnAttack) while having no code that makes it
// *happen*. Nothing links those registries, so the card looks implemented from every angle except
// actually using it — and for an Action ability the cost is still paid, so it silently eats a
// resource and exhausts the leader.
//
// These tests re-derive each registry from source and assert they agree. KNOWN_GAPS lists the
// cards still awaiting implementation; every entry is a real bug, and the lists must only shrink.

const ROOT = path.resolve(__dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** Body of a function, by brace-matching from its declaration. */
function funcBody(src: string, re: RegExp): string {
  const m = src.match(re);
  if (!m) throw new Error(`declaration not found: ${re}`);
  let i = src.indexOf("{", m.index!);
  let depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces");
}

const caseIds = (body: string) => [...body.matchAll(/case\s+"([A-Z0-9]+_[A-Z0-9]+)"/g)].map(m => m[1]);
const quotedIds = (body: string) => [...body.matchAll(/"([A-Z0-9]+_[0-9]+)"/g)].map(m => m[1]);

const dispatch = read("src/server/engine/dispatch-listener.ts");
const coreFns = read("src/server/engine/core-functions.ts");
const actionAb = read("src/server/engine/actions/action-ability.ts");
const onAttackSrc = read("src/server/engine/actions/on-attack.ts");
const puzzleUI = read("src/containers/PuzzlesPage.tsx");

/** Cards the engine OFFERS as an activatable Action. */
const offered = new Set(caseIds(funcBody(actionAb, /export function ActionAbilities\(/)));
/** Cards with an execution case — the only path that runs when the Action is used. */
const executes = new Set(caseIds(funcBody(dispatch, /function resolveActionAbility\(/)));
/** Leaders the Puzzles UI renders an action button for. */
const uiButtons = new Set(
  quotedIds((puzzleUI.match(/LEADERS_WITH_ACTION_ABILITY = new Set\(\[[\s\S]*?\]\)/) ?? [""])[0]),
);
/** Every way a card can be recognised as having an On Attack trigger. */
const onAttackRegistered = new Set([
  ...caseIds(funcBody(coreFns, /export function HasOnAttack\(/)),
  ...quotedIds(funcBody(coreFns, /function UpgradeGrantsOnAttack\(/)),
  ...quotedIds(funcBody(coreFns, /function EffectGrantsOnAttack\(/)),
]);
/** Every place an On Attack trigger is actually resolved. */
const onAttackHandled = new Set([
  ...caseIds(onAttackSrc),
  ...quotedIds(funcBody(dispatch, /function applyAutoOnAttackEffects\(/)),
]);

const label = (id: string) => `${id} (${CardTitle(id) ?? "?"})`;
const report = (ids: string[]) => ids.sort().map(label).join("\n  ");

// Cards still awaiting implementation. Each entry is a known bug — shrink, never grow.
const KNOWN_GAPS: Record<"noExecution" | "noUiButton" | "deployedOnAttackUnregistered" | "onAttackNoHandler", string[]> = {
  // Leader Actions that still pay their cost and do nothing. Mostly the "play a card from your
  // hand" family (needs per-card validation on PlayFromHandPending) plus three that need new
  // engine plumbing: SOR_017/SHD_009 (delayed start-of-next-action-phase defeat, resource reveal)
  // and SOR_009 (attack twice).
  noExecution: [
    "SHD_006", // Jabba the Hutt — grant a Bounty that discounts your next unit
    "SHD_009", // Hunter — reveal a resource, name-match a unique unit
    "SHD_017", // Lando Calrissian — play via Smuggle for 2 less, defeat a resource
    "SOR_009", // Leia Organa — attack with a Rebel unit, then optionally another
    "SOR_017", // Han Solo — resource from hand, defeat a resource next action phase
  ],
  // Implemented in the engine but with no button in the Puzzles UI. Each is blocked on its
  // execution case above — adding a button first would just surface a no-op.
  noUiButton: [] as string[],
  // Deployed leader sides whose On Attack never fires.
  deployedOnAttackUnregistered: [
    "ASH_004", // Grand Admiral Thrawn — may defeat an enemy unit if you control more units
    "SHD_009", // Hunter — reveal a resource (same machinery as his leader side)
    "SOR_016", // Grand Admiral Thrawn — reveal a deck card, exhaust a unit costing <= it
    "SOR_017", // Han Solo — resource from deck, defeat a resource next action phase
  ],
  // Events that grant an On Attack the engine never resolves: AttackAbilityCardIds() returns only
  // the unit's own (and Support-granted) cardId, so an effect-granted ability has no handler.
  onAttackNoHandler: [
    "LAW_169", // Payroll Heist — friendly units gain "On Attack: Create a Credit token"
    "LOF_205", // Force Speed — attacker gains "On Attack: return non-unique upgrades on defender"
  ],
};

describe("ability registry consistency", () => {
  it("every Action ability the engine offers has an execution case", () => {
    const allowed = new Set(KNOWN_GAPS.noExecution);
    const broken = [...offered].filter(id => !executes.has(id) && !allowed.has(id));
    expect(broken, `These pay their cost and then do nothing:\n  ${report(broken)}\n`).toEqual([]);
  });

  it("every leader Action the engine offers has a button in the Puzzles UI", () => {
    const allowed = new Set(KNOWN_GAPS.noUiButton);
    const broken = [...offered]
      .filter(id => CardType(id) === "Leader" && !uiButtons.has(id) && !allowed.has(id));
    expect(broken, `Implemented but unreachable in-game:\n  ${report(broken)}\n`).toEqual([]);
  });

  it("every leader whose deployed side has an On Attack is registered in HasOnAttack", () => {
    const allowed = new Set(KNOWN_GAPS.deployedOnAttackUnregistered);
    const supported = [...new Set([...offered, ...uiButtons])].filter(id => CardType(id) === "Leader");
    const broken = supported.filter(
      id => (CardLeaderUnitText(id) ?? "").includes("On Attack")
        && !onAttackRegistered.has(id)
        && !allowed.has(id),
    );
    expect(broken, `Deployed On Attack never fires:\n  ${report(broken)}\n`).toEqual([]);
  });

  it("every card registered as having an On Attack has a handler", () => {
    const allowed = new Set(KNOWN_GAPS.onAttackNoHandler);
    const broken = [...onAttackRegistered].filter(id => !onAttackHandled.has(id) && !allowed.has(id));
    expect(broken, `Trigger fires but resolves to nothing:\n  ${report(broken)}\n`).toEqual([]);
  });

  it("no execution case exists for an ability that is never offered (dead code)", () => {
    const dead = [...executes].filter(id => !offered.has(id) && !uiButtons.has(id));
    expect(dead, `Unreachable execution cases:\n  ${report(dead)}\n`).toEqual([]);
  });

  it("the KNOWN_GAPS allowlist only contains cards that are genuinely still broken", () => {
    // Stops the allowlist from rotting: once a card is fixed its entry must be removed.
    const stale = [
      ...KNOWN_GAPS.noExecution.filter(id => executes.has(id)),
      ...KNOWN_GAPS.noUiButton.filter(id => uiButtons.has(id)),
      ...KNOWN_GAPS.deployedOnAttackUnregistered.filter(id => onAttackRegistered.has(id)),
      ...KNOWN_GAPS.onAttackNoHandler.filter(id => onAttackHandled.has(id)),
    ];
    expect(stale, `Fixed — remove from KNOWN_GAPS:\n  ${report(stale)}\n`).toEqual([]);
  });
});
