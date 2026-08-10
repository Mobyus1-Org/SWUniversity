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
};

const LEADER_BACK_SIDES: Record<string, LeaderBackSide> = {
  // TWI_017 Chancellor Palpatine // Darth Sidious — "Playing Both Sides".
  // Currently the only card in the entire set list whose second side is another Leader.
  TWI_017: {
    title: "Darth Sidious",
    subtitle: "Playing Both Sides",
    traits: ["Force", "Separatist", "Sith"],
  },
};

/** The flipped face of a double-sided leader, or null for every ordinary card. */
export function LeaderBackSideOf(cardId: string): LeaderBackSide | null {
  return LEADER_BACK_SIDES[cardId] ?? null;
}
