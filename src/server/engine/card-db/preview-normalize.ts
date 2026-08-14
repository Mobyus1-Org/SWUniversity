/**
 * Converts swudb preview-card markup into the plain text the generated dictionaries store.
 *
 * Every rule here was verified against live records compared field-by-field with our official
 * dictionary rows: ASH_004 (paired tags, `{T}` inside a cost list, `{restore:2}`, epic action),
 * ASH_237 (`{raid:1}`, bare `{imperial}`), ASH_240 (the leading-space trait bug) and SOR_246
 * (`{R5}` standing alone in prose).
 *
 * See docs/superpowers/specs/2026-08-11-card-mock-framework-design.md §4.
 */

export const PREVIEW_CARD_TYPES: Record<number, string> = {
  0: "Leader",
  1: "Base",
  2: "Unit",
  3: "Event",
  4: "Upgrade",
};

export const PREVIEW_ARENAS: Record<number, string> = {
  0: "Ground",
  1: "Space",
};

// NOTE the order: 1 is Aggression and 2 is Command, NOT the other way round. Verified against our
// own dictionaries (ASH_004 aspects [4,6] = Vigilance,Villainy). Guessing the intuitive order
// silently mislabels every mono-Command and mono-Aggression card.
export const PREVIEW_ASPECTS: Record<number, string> = {
  1: "Aggression",
  2: "Command",
  3: "Cunning",
  4: "Vigilance",
  5: "Heroism",
  6: "Villainy",
};

export const PREVIEW_RARITIES: Record<number, string> = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Legendary",
  5: "Special",
};

// A sentinel that cannot occur in card text, marking resolved cost tokens so their bracket
// context can be decided in one pass afterwards. Written as an escape on purpose: a literal
// control byte in a source file is invisible and does not survive a copy-paste.
const COST_TOKEN_DELIMITER = "\u0001";

function countOccurrences(text: string, character: string): number {
  let count = 0;
  for (const candidate of text) {
    if (candidate === character) {
      count += 1;
    }
  }
  return count;
}

/**
 * Emit each delimited cost token bare when it already sits inside a `[...]` cost list, or wrapped
 * in its own brackets when it stands alone in prose. Both forms occur in the official dictionaries:
 * "Action [1 resource, Exhaust]" vs "It costs [5 resources] less."
 */
function resolveCostTokens(text: string): string {
  const parts = text.split(COST_TOKEN_DELIMITER);
  let depth = 0;
  let out = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (index % 2 === 1) {
      // Odd parts are the tokens themselves.
      out += depth > 0 ? part : `[${part}]`;
      continue;
    }

    depth += countOccurrences(part, "[") - countOccurrences(part, "]");
    if (depth < 0) {
      depth = 0;
    }
    out += part;
  }

  return out;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function normalizePreviewText(raw: string): string {
  if (raw.trim() === "") {
    return "";
  }

  let text = raw;

  // Epic-action paragraphs carry no literal label in the source; our dictionaries store one.
  // Without this every mocked leader's epic action is silently wrong.
  text = text.replaceAll("{p-epic-action}", "{p}Epic Action: ");

  // Paragraphs become newline separated.
  text = text.replace(/\{\/p[^}]*\}\s*/g, "\n");
  text = text.replace(/\{p[^}]*\}/g, "");

  // PAIRED tags leave their contents behind — any tag with a matching closer, not a known list:
  // the source wraps trait references as "{trait}Kashyyyk{/trait}", and treating the opener as a
  // standalone icon yields "TraitKashyyyk{/trait}". Loop for nesting.
  let previous = "";
  while (previous !== text) {
    previous = text;
    text = text.replace(/\{([a-z][a-z0-9-]*)\}([\s\S]*?)\{\/\1\}/gi, "$2");
  }

  // Any closer left over from unbalanced upstream markup must not survive into card text.
  text = text.replace(/\{\/[a-z0-9-]+\}/gi, "");

  // Cost icons are bracket-context sensitive, so mark them and resolve against bracket depth.
  text = text.replace(/\{R(\d+)\}/g, (_match, digits: string) => {
    const amount = Number.parseInt(digits, 10);
    const noun = amount === 1 ? "resource" : "resources";
    return `${COST_TOKEN_DELIMITER}${amount} ${noun}${COST_TOKEN_DELIMITER}`;
  });
  text = text.replaceAll("{T}", `${COST_TOKEN_DELIMITER}Exhaust${COST_TOKEN_DELIMITER}`);
  text = resolveCostTokens(text);

  // Valued keyword tags: {restore:2} -> "Restore 2". Must run BEFORE the bare-tag rule, whose
  // [a-z]+ pattern the colon and digits defeat — leaving "{restore:2}" verbatim in card text.
  text = text.replace(/\{([a-z][a-z0-9-]*):(\d+)\}/gi, (_match, name: string, value: string) => {
    return `${capitalize(name)} ${value}`;
  });

  // Remaining bare icon tags become their word: {vehicle} -> Vehicle.
  text = text.replace(/\{([a-z]+)\}/gi, (_match, name: string) => capitalize(name));

  // The source omits the space before a parenthetical when the keyword was an icon tag
  // ("{fortify}{i}(Attach..." -> "Fortify(Attach..."). Card text always reads with the space.
  text = text.replace(/([A-Za-z0-9])\(/g, "$1 (");

  // Collapse the whitespace tag removal left behind.
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/ *\n */g, "\n");

  return text.trim();
}

/**
 * Traits, cleaned. The source is inconsistent: elements can carry leading spaces (ASH_240 comes
 * back as ["Mandalorian", " Trooper"]) and occasionally arrive comma-joined in one string, which
 * would produce a trait literally named " Trooper" that no trait check ever matches.
 */
export function previewTraitList(traits: unknown): string[] {
  const source = Array.isArray(traits) ? traits : [];
  const out: string[] = [];

  for (const entry of source) {
    for (const piece of String(entry).split(",")) {
      const trimmed = piece.trim();
      if (trimmed !== "" && !out.includes(trimmed)) {
        out.push(trimmed);
      }
    }
  }

  return out;
}
