/**
 * Second-side data for double-sided leaders — leaders that FLIP between two leader faces rather
 * than deploying into a unit.
 *
 * Hand-maintained on purpose. The upstream card API carries `type2` and `deployBox` (the second
 * side's rules text) but has NO second-side title, subtitle or traits: TWI_017 comes back with
 * title "Chancellor Palpatine" and traits ["Republic","Official"] only, even though its back is
 * Darth Sidious — Force/Separatist/Sith. There is nothing for the generator to read, so this
 * cannot live in generated.ts.
 *
 * A leader belongs here exactly when `CardType2(cardId) === "Leader"`; every other leader's
 * second side is a Unit and is already fully described by the generated dictionaries.
 */

export type LeaderBackSide = {
  title: string;
  subtitle: string;
  traits: string[];
  /** The aspect icons printed on the BACK face alone — see LEADER_FRONT_ASPECTS. */
  aspects: string[];
};

const LEADER_BACK_SIDES: Record<string, LeaderBackSide> = {
  // TWI_017 Chancellor Palpatine // Darth Sidious — "Playing Both Sides".
  // Currently the only card in the entire set list whose second side is another Leader.
  TWI_017: {
    title: "Darth Sidious",
    subtitle: "Playing Both Sides",
    traits: ["Force", "Separatist", "Sith"],
    aspects: ["Cunning", "Villainy"],
  },
};

/**
 * The aspect icons printed on the FRONT face alone.
 *
 * The upstream data has no per-side aspect split either: TWI_017's `aspects` is the UNION of both
 * faces — Cunning/Villainy/Heroism — even though the card only ever shows two icons at a time
 * (Chancellor is Cunning/Heroism, Sidious is Cunning/Villainy). Left unsplit, the leader covers
 * Heroism AND Villainy simultaneously and no card the player deploys ever pays an aspect penalty.
 */
const LEADER_FRONT_ASPECTS: Record<string, string[]> = {
  TWI_017: ["Cunning", "Heroism"],
};

/** The front face's own aspects, or null for every card whose printed list is already one side. */
export function LeaderFrontAspectsOf(cardId: string): string[] | null {
  return LEADER_FRONT_ASPECTS[cardId] ?? null;
}

/** The flipped face of a double-sided leader, or null for every ordinary card. */
export function LeaderBackSideOf(cardId: string): LeaderBackSide | null {
  return LEADER_BACK_SIDES[cardId] ?? null;
}
